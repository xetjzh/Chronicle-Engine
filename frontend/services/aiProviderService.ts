import { AIProviderConfig, AIProviderType, SamplingParams } from '../types';

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  lorebookBlock?: string;       // SillyTavern 激活的世界书块
  authorsNote?: string;         // 作者附注
  overrideSampling?: Partial<SamplingParams>;
  thinkingBudget?: number;
  signal?: AbortSignal;
}

export interface ProviderHealthResult {
  provider: AIProviderType;
  ok: boolean;
  message: string;
  latencyMs?: number;
}

// Only errors created here are safe to show in the UI. Provider bodies and
// transport exceptions may contain API keys, custom headers, or signed URLs.
class ProviderRequestError extends Error {}

export class AIProviderService {
  private static readonly HEALTH_TIMEOUT_MS = 20000;

  private static canceledError(): Error {
    const error = new ProviderRequestError('请求已取消。');
    error.name = 'AbortError';
    return error;
  }

  private static requireModel(value: string, provider: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ProviderRequestError(`请先填写 ${provider} 模型名称。`);
    }
    return value.trim();
  }

  private static endpoint(baseUrl: string, provider: 'ollama' | 'openai_compatible', action = 'chat'): string {
    let url: URL;
    try {
      url = new URL(baseUrl.trim());
    } catch {
      throw new ProviderRequestError('接口地址无效，请填写完整的 HTTP 或 HTTPS URL。');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ProviderRequestError('接口地址仅支持 HTTP 或 HTTPS。');
    }
    if (url.username || url.password) {
      throw new ProviderRequestError('接口地址不能包含登录凭据，请使用 API 密钥或自定义认证请求头。');
    }
    let pathname = url.pathname.replace(/\/+$/, '');
    if (provider === 'ollama') {
      pathname = pathname.replace(/\/api\/(chat|tags)$/, '/api');
      url.pathname = pathname.endsWith('/api') ? `${pathname}/${action}` : `${pathname}/api/${action}`;
    } else {
      url.pathname = pathname.endsWith('/chat/completions') ? pathname : `${pathname}/chat/completions`;
    }
    url.hash = '';
    return url.toString();
  }

  private static httpError(provider: string, status: number): ProviderRequestError {
    let guidance = '请检查接口配置后重试。';
    if (status === 401 || status === 403) guidance = '请检查 API 密钥、认证请求头及访问权限。';
    else if (status === 404) guidance = '请检查接口地址和模型名称。';
    else if (status === 429) guidance = '请求限流或额度不足，请检查服务商额度后稍后重试。';
    else if (status >= 500) guidance = '服务商暂时不可用，请稍后重试。';
    else if (status === 400 || status === 422) guidance = '请检查模型名称和采样参数是否受该服务支持。';
    return new ProviderRequestError(`${provider} 响应错误 [HTTP ${status}]。${guidance}`);
  }

  private static requireText(value: unknown, provider: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ProviderRequestError(`${provider} 未返回有效文本，请检查模型、输出限制或内容过滤设置后重试。`);
    }
    return value;
  }

  private static isGemini25Pro(model: string): boolean {
    return /^gemini-2\.5-pro(?:$|-)/.test(model.split('/').pop() || '');
  }

  /** One deadline includes connection, SDK processing and complete body reads. */
  private static async boundedRequest<T>(
    provider: string,
    timeoutMs: number,
    signal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (signal?.aborted) throw this.canceledError();
    const controller = new AbortController();
    let rejectInterrupted!: (reason: Error) => void;
    const interrupted = new Promise<never>((_resolve, reject) => { rejectInterrupted = reject; });
    const onAbort = () => {
      rejectInterrupted(this.canceledError());
      controller.abort();
    };
    const timeoutId = setTimeout(() => {
      rejectInterrupted(new ProviderRequestError(`${provider} 请求超时（超过 ${timeoutMs / 1000} 秒）。请检查网络、服务状态或选用更轻的模型。`));
      controller.abort();
    }, timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await Promise.race([operation(controller.signal), interrupted]);
    } catch (error: unknown) {
      if (error instanceof ProviderRequestError) throw error;
      const status = (error as { status?: unknown; code?: unknown })?.status
        ?? (error as { code?: unknown })?.code;
      if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) {
        throw this.httpError(provider, status);
      }
      throw new ProviderRequestError(`${provider} 连接失败，请检查接口地址、认证配置、代理、浏览器跨域设置和网络连接。`);
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private static async requestJson(url: string, init: RequestInit, provider: string): Promise<any> {
    const response = await fetch(url, init);
    if (!response.ok) {
      // Do not surface or parse provider error bodies: these can echo secrets.
      void response.body?.cancel().catch(() => {});
      throw this.httpError(provider, response.status);
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderRequestError(`${provider} 响应不是有效 JSON，请检查接口地址及代理返回内容。`);
    }
  }

  /**
   * Unified text generation across Gemini, Ollama, and OpenAI-compatible endpoints
   * Orchestrates SillyTavern's hierarchical prompt assembly:
   * 1. System Core Instructions
   * 2. Lorebook / World Info
   * 3. Episodic Context & Events
   * 4. Author's Note (near bottom for recency effect)
   */
  public static async generateText(
    config: AIProviderConfig,
    options: GenerateTextOptions
  ): Promise<string> {
    const provider = config.activeProvider;

    switch (provider) {
      case 'gemini':
        return this.callGemini(config, options);
      case 'ollama':
        return this.callOllama(config, options);
      case 'openai_compatible':
        return this.callOpenAICompatible(config, options);
      default:
        throw new ProviderRequestError('未知的 AI 提供商类型，请重新选择提供商。');
    }
  }

  /**
   * Constructs SillyTavern-style complete combined prompt with Lorebook and Author's Note
   */
  private static assemblePromptWithContext(options: GenerateTextOptions): string {
    const parts: string[] = [];

    if (options.lorebookBlock && options.lorebookBlock.trim().length > 0) {
      parts.push(options.lorebookBlock);
      parts.push('------------------------');
    }

    parts.push(options.prompt);

    if (options.authorsNote && options.authorsNote.trim().length > 0) {
      parts.push('------------------------');
      parts.push(options.authorsNote);
    }

    return parts.join('\n\n');
  }

  /**
   * Official Google Gemini implementation adhering strictly to @google/genai SDK rules
   */
  private static async callGemini(
    config: AIProviderConfig,
    options: GenerateTextOptions,
    timeoutMs = 90000
  ): Promise<string> {
    const model = this.requireModel(config.gemini.model, 'Gemini');
    
    const sampling = { ...config.sampling, ...options.overrideSampling };
    const fullPrompt = this.assemblePromptWithContext(options);

    const requestConfig: any = {
      temperature: sampling.temperature ?? 0.8,
      topP: sampling.topP ?? 0.95,
      topK: sampling.topK ?? 40,
    };

    if (options.systemInstruction) {
      requestConfig.systemInstruction = options.systemInstruction;
    }

    // Thinking Budget: default 0 for responsive latency, or custom
    const requestedThinkingBudget = options.thinkingBudget ?? config.gemini.thinkingBudget;
    // Pro cannot disable thinking. Use its minimum for legacy disabled or
    // absent budgets without changing saved settings or user output caps.
    const thinkingBudget = this.isGemini25Pro(model)
      && (requestedThinkingBudget === 0 || requestedThinkingBudget === undefined)
      ? 128 : requestedThinkingBudget;
    if (typeof thinkingBudget === 'number') {
      requestConfig.thinkingConfig = { thinkingBudget };
    }

    if (sampling.maxTokens) {
      requestConfig.maxOutputTokens = sampling.maxTokens;
      // When maxOutputTokens is set on gemini-2.5-flash, thinkingBudget must be set smaller
      if (!requestConfig.thinkingConfig) {
        requestConfig.thinkingConfig = { thinkingBudget: Math.min(200, Math.floor(sampling.maxTokens / 4)) };
      }
    }

    const effectiveThinkingBudget = requestConfig.thinkingConfig?.thinkingBudget;
    if (this.isGemini25Pro(model) && effectiveThinkingBudget > 0
      && typeof sampling.maxTokens === 'number' && sampling.maxTokens <= effectiveThinkingBudget) {
      throw new ProviderRequestError('Gemini 2.5 Pro 的输出上限必须大于思考预算，请提高最大输出 Token 限制后重试。');
    }

    if (sampling.stopSequences && sampling.stopSequences.length > 0) {
      requestConfig.stopSequences = sampling.stopSequences;
    }

    return this.boundedRequest('Gemini', timeoutMs, options.signal, async signal => {
      const { GoogleGenAI } = await import('@google/genai');
      if (signal.aborted) throw this.canceledError();
      // SECURITY: When vertexai is true the SDK routes through the backend
      // ADC proxy (vertex-ai-proxy-interceptor.js) and no API key is needed.
      // Do NOT pass process.env.API_KEY here: Vite would inline the value as a
      // plain string into the production bundle, exposing it to every visitor.
      // If a direct Gemini API key is ever required, source it from
      // config.gemini.apiKey (user-supplied at runtime) instead.
      const ai = new GoogleGenAI({ vertexai: true });
      const response = await ai.models.generateContent({
        model,
        contents: {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
        config: {
          ...requestConfig,
          abortSignal: signal,
          httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
        },
      });
      return this.requireText(response.text, 'Gemini');
    });
  }

  /**
   * Ollama native HTTP endpoint with SillyTavern-grade sampling:
   * repeat_penalty, top_p, top_k, num_ctx, stop sequences.
   */
  private static async callOllama(
    config: AIProviderConfig,
    options: GenerateTextOptions
  ): Promise<string> {
    const model = this.requireModel(config.ollama.model, 'Ollama');
    const url = this.endpoint(config.ollama.baseUrl, 'ollama');

    const sampling = { ...config.sampling, ...options.overrideSampling };
    const fullPrompt = this.assemblePromptWithContext(options);

    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: fullPrompt });

    const payload = {
      model,
      messages,
      stream: false,
      options: {
        temperature: sampling.temperature ?? 0.7,
        top_p: sampling.topP ?? 0.9,
        top_k: sampling.topK ?? 40,
        repeat_penalty: sampling.repetitionPenalty ?? 1.15,
        presence_penalty: sampling.presencePenalty ?? 0.2,
        frequency_penalty: sampling.frequencyPenalty ?? 0.2,
        num_ctx: config.ollama.contextLength || 8192,
        num_predict: sampling.maxTokens || 2500,
        stop: sampling.stopSequences || [],
      },
      keep_alive: config.ollama.keepAlive || '5m',
    };

    return this.boundedRequest('Ollama', 120000, options.signal, async signal => {
      const data = await this.requestJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      }, 'Ollama');
      return this.requireText(data?.message?.content ?? data?.response, 'Ollama');
    });
  }

  /**
   * OpenAI Compatible endpoint (DeepSeek, 通义千问, SiliconFlow)
   * Supports temperature, top_p, frequency_penalty, presence_penalty, stop
   */
  private static async callOpenAICompatible(
    config: AIProviderConfig,
    options: GenerateTextOptions,
    timeoutMs = 90000
  ): Promise<string> {
    const model = this.requireModel(config.openaiCompatible.model, 'OpenAI 兼容接口');
    const url = this.endpoint(config.openaiCompatible.baseUrl, 'openai_compatible');

    const sampling = { ...config.sampling, ...options.overrideSampling };
    const fullPrompt = this.assemblePromptWithContext(options);

    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: fullPrompt });

    const payload: any = {
      model,
      messages,
      temperature: sampling.temperature ?? 0.7,
      top_p: sampling.topP ?? 0.9,
      frequency_penalty: sampling.frequencyPenalty ?? 0.2,
      presence_penalty: sampling.presencePenalty ?? 0.2,
      stream: false,
    };

    if (sampling.maxTokens) {
      payload.max_tokens = sampling.maxTokens;
    }
    if (sampling.stopSequences && sampling.stopSequences.length > 0) {
      payload.stop = sampling.stopSequences;
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });
    try {
      for (const [name, value] of Object.entries(config.openaiCompatible.customHeaders || {})) {
        headers.set(name, value);
      }
      if (config.openaiCompatible.apiKey?.trim()) {
        headers.set('Authorization', `Bearer ${config.openaiCompatible.apiKey.trim()}`);
      }
    } catch {
      throw new ProviderRequestError('认证或自定义请求头格式无效，请检查请求头名称、值及 API 密钥。');
    }

    return this.boundedRequest('OpenAI 兼容接口', timeoutMs, options.signal, async signal => {
      const data = await this.requestJson(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      }, 'OpenAI 兼容接口');
      return this.requireText(data?.choices?.[0]?.message?.content, 'OpenAI 兼容接口');
    });
  }

  /**
   * Tests health and ping for a specific provider
   */
  public static async testProviderHealth(
    provider: AIProviderType,
    config: AIProviderConfig,
    signal?: AbortSignal
  ): Promise<ProviderHealthResult> {
    const start = performance.now();
    try {
      if (provider === 'gemini') {
        const pro = this.isGemini25Pro(this.requireModel(config.gemini.model, 'Gemini'));
        await this.callGemini(config, {
          prompt: '回复两个字：就绪', thinkingBudget: pro ? 128 : 0, signal,
          overrideSampling: { maxTokens: pro ? 256 : 64, stopSequences: [] },
        }, this.HEALTH_TIMEOUT_MS);
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'gemini',
          ok: true,
          message: 'Gemini 连通正常，已收到所选模型的有效文本回复。',
          latencyMs: latency,
        };
      }

      if (provider === 'ollama') {
        const model = this.requireModel(config.ollama.model, 'Ollama');
        const url = this.endpoint(config.ollama.baseUrl, 'ollama', 'tags');
        await this.boundedRequest('Ollama', this.HEALTH_TIMEOUT_MS, signal, async requestSignal => {
          const data = await this.requestJson(url, { method: 'GET', signal: requestSignal }, 'Ollama');
          if (!Array.isArray(data?.models) || data.models.some((entry: any) => typeof entry?.name !== 'string')) {
            throw new ProviderRequestError('Ollama 模型列表响应无效，请检查接口地址及代理配置。');
          }
          const hasTag = model.split('/').pop()!.includes(':');
          if (!data.models.some((entry: any) => entry.name === model || (!hasTag && entry.name === `${model}:latest`))) {
            throw new ProviderRequestError('Ollama 服务在线，但未安装所选模型。请先下载该模型或修改模型名称。');
          }
        });
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'ollama',
          ok: true,
          message: 'Ollama 服务在线，所选模型已安装。',
          latencyMs: latency,
        };
      }

      if (provider === 'openai_compatible') {
        await this.callOpenAICompatible(config, {
          prompt: '请回复测试：连通成功',
          signal,
          overrideSampling: { temperature: 0.2, maxTokens: 32, stopSequences: [] },
        }, this.HEALTH_TIMEOUT_MS);
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'openai_compatible',
          ok: true,
          message: '接口调用成功，已收到所选模型的有效文本回复。',
          latencyMs: latency,
        };
      }

      return { provider, ok: false, message: '未适配的提供商' };
    } catch (err: unknown) {
      const latency = Math.round(performance.now() - start);
      return {
        provider,
        ok: false,
        message: `连接失败: ${err instanceof ProviderRequestError ? err.message : '请检查提供商配置后重试。'}`,
        latencyMs: latency,
      };
    }
  }
}
