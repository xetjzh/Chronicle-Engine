import { AIProviderConfig, AIProviderType, SamplingParams } from '../types';

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  lorebookBlock?: string;       // SillyTavern 激活的世界书块
  authorsNote?: string;         // 作者附注
  overrideSampling?: Partial<SamplingParams>;
  thinkingBudget?: number;
}

export interface ProviderHealthResult {
  provider: AIProviderType;
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export class AIProviderService {
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
        throw new Error(`未知的 AI 提供商类型: ${provider}`);
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
    options: GenerateTextOptions
  ): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
    
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
    const thinkingBudget = options.thinkingBudget ?? config.gemini.thinkingBudget;
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

    if (sampling.stopSequences && sampling.stopSequences.length > 0) {
      requestConfig.stopSequences = sampling.stopSequences;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
      config: requestConfig,
    });

    return response.text || '';
  }

  /**
   * Ollama native HTTP endpoint with SillyTavern-grade sampling:
   * repeat_penalty, top_p, top_k, num_ctx, stop sequences.
   */
  private static async callOllama(
    config: AIProviderConfig,
    options: GenerateTextOptions
  ): Promise<string> {
    const baseUrl = config.ollama.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/api/chat`;

    const sampling = { ...config.sampling, ...options.overrideSampling };
    const fullPrompt = this.assemblePromptWithContext(options);

    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: fullPrompt });

    const payload = {
      model: config.ollama.model || 'qwen2.5:7b-instruct-q4_K_M',
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama 响应错误 [${res.status}]: ${errText || res.statusText}`);
      }

      const data = await res.json();
      return data.message?.content || data.response || '';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Ollama 请求超时 (超过 120 秒)。ARM 处理器可能正在加载较大模型，请降低 num_ctx 或选用更轻的 Q4 量化。');
      }
      throw new Error(`连接 Ollama 失败 (${url}): ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * OpenAI Compatible endpoint (DeepSeek, 通义千问, SiliconFlow)
   * Supports temperature, top_p, frequency_penalty, presence_penalty, stop
   */
  private static async callOpenAICompatible(
    config: AIProviderConfig,
    options: GenerateTextOptions
  ): Promise<string> {
    let baseUrl = config.openaiCompatible.baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
      baseUrl = `${baseUrl}/chat/completions`;
    }

    const sampling = { ...config.sampling, ...options.overrideSampling };
    const fullPrompt = this.assemblePromptWithContext(options);

    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: fullPrompt });

    const payload: any = {
      model: config.openaiCompatible.model || 'deepseek-chat',
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.openaiCompatible.customHeaders || {}),
    };
    if (config.openaiCompatible.apiKey) {
      headers['Authorization'] = `Bearer ${config.openaiCompatible.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI 兼容端点响应错误 [${res.status}]: ${errText || res.statusText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('OpenAI 兼容接口请求超时。');
      }
      throw new Error(`调用 OpenAI 兼容端点失败 (${baseUrl}): ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Tests health and ping for a specific provider
   */
  public static async testProviderHealth(
    provider: AIProviderType,
    config: AIProviderConfig
  ): Promise<ProviderHealthResult> {
    const start = performance.now();
    try {
      if (provider === 'gemini') {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: '回复两个字：就绪',
          config: { thinkingConfig: { thinkingBudget: 0 } },
        });
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'gemini',
          ok: true,
          message: `Gemini 2.5 Flash 连通正常！响应: "${res.text?.trim()}"`,
          latencyMs: latency,
        };
      }

      if (provider === 'ollama') {
        const baseUrl = config.ollama.baseUrl.replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name).join(', ') || '未发现已下载模型';
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'ollama',
          ok: true,
          message: `Ollama 服务在线！已安装模型: ${models}`,
          latencyMs: latency,
        };
      }

      if (provider === 'openai_compatible') {
        const text = await this.callOpenAICompatible(config, {
          prompt: '请回复测试：连通成功',
          overrideSampling: { temperature: 0.2 },
        });
        const latency = Math.round(performance.now() - start);
        return {
          provider: 'openai_compatible',
          ok: true,
          message: `接口调用成功！模型回复: "${text.slice(0, 30)}"`,
          latencyMs: latency,
        };
      }

      return { provider, ok: false, message: '未适配的提供商' };
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      return {
        provider,
        ok: false,
        message: `连接失败: ${err.message}`,
        latencyMs: latency,
      };
    }
  }
}
