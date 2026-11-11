const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transform } = require('sucrase');

// Keep the service real and replace only network/SDK boundaries. No provider
// credentials, live inference, or billable requests are used by this suite.
function service({ fetch, generateContent, generateContentStream, timerMs } = {}) {
  const timers = new Set();
  const output = transform(fs.readFileSync(path.join(__dirname, 'aiProviderService.ts'), 'utf8'), {
    transforms: ['typescript', 'imports'],
  }).code;
  const module = { exports: {} };
  const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`, {
    Headers, URL, AbortController, performance,
    process: { env: { API_KEY: 'environment-secret' } },
    fetch: fetch || (() => { throw new Error('Unexpected network request'); }),
    setTimeout(callback, delay) {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, timerMs ?? delay);
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
  }, { filename: 'aiProviderService.ts' });
  evaluate(specifier => {
    if (specifier === './textStream') return require('../testSupport/loadService.cjs').loadService(path.join(__dirname, 'textStream.ts'));
    assert.equal(specifier, '@google/genai');
    return { GoogleGenAI: class { models = { generateContent, generateContentStream }; } };
  }, module, module.exports);
  return { AIProviderService: module.exports.AIProviderService, timers };
}

test('generation streams actual compatible SSE and Ollama NDJSON deltas with one request', async () => {
  for (const provider of ['openai_compatible', 'ollama']) {
    const deltas = []; let calls = 0;
    const { AIProviderService } = service({ fetch: async (_url, init) => {
      calls++; assert.equal(JSON.parse(init.body).stream, true);
      return new Response(provider === 'ollama' ? '{"message":{"content":"实时"},"done":false}\n{"message":{"content":"正文"},"done":true}\n' : 'data: {"choices":[{"delta":{"content":"实时"}}]}\n\ndata: {"choices":[{"delta":{"content":"正文"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': provider === 'ollama' ? 'application/x-ndjson' : 'text/event-stream' } });
    } });
    const result = await AIProviderService.generateText(config(provider), { prompt: '写作', onText: d => deltas.push(d) });
    assert.equal(result, '实时正文'); assert.equal(deltas.join('|'), '实时|正文'); assert.equal(calls, 1);
  }
});
test('Gemini streaming uses the installed SDK stream interface and preserves cancellation', async () => {
  const deltas = [], controller = new AbortController();
  const { AIProviderService } = service({ generateContentStream: async function* (req) {
    assert.ok(req.config.abortSignal); yield { text: '第一段' }; yield { text: '第二段', candidates: [{ finishReason: 'STOP' }] };
  } });
  assert.equal(await AIProviderService.generateText(config('gemini'), { prompt: '写作', signal: controller.signal, onText: d => deltas.push(d) }), '第一段第二段');
  assert.equal(deltas.length, 2);
});

test('the public stream generator cancels the transport when its consumer stops early', async () => {
  let signal, canceled = false;
  const { AIProviderService, timers } = service({ fetch: async (_url, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"预览"}}]}\n\n')); },
      cancel() { canceled = true; },
    }), { headers: { 'content-type': 'text/event-stream' } });
  } });
  const iterator = AIProviderService.generateTextStream(config(), { prompt: '写作' });
  assert.equal((await iterator.next()).value, '预览');
  await iterator.return();
  assert.equal(signal.aborted, true); assert.equal(canceled, true); assert.equal(timers.size, 0);
});

function config(provider = 'openai_compatible') {
  return {
    activeProvider: provider,
    sampling: { temperature: 0.7, topP: 0.9, topK: 40, repetitionPenalty: 1.1,
      frequencyPenalty: 0.2, presencePenalty: 0.2, maxTokens: 1500, stopSequences: ['STOP'] },
    gemini: { model: 'gemini-2.5-pro', thinkingBudget: 0 },
    ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b', contextLength: 8192, keepAlive: '5m' },
    openaiCompatible: { baseUrl: 'https://gateway.example/v1', model: 'configured-model', apiKey: 'key-secret' },
  };
}

const json = body => Response.json(body);
const completion = text => json({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });

test('compatible endpoint normalization appends paths before query parameters without duplicating the endpoint', async () => {
  for (const [baseUrl, expected] of [
    ['  https://gateway.example/v1/?key=query-secret  ', 'https://gateway.example/v1/chat/completions?key=query-secret'],
    ['https://gateway.example/custom/chat/completions/?key=query-secret#fragment', 'https://gateway.example/custom/chat/completions?key=query-secret'],
  ]) {
    const input = config();
    input.openaiCompatible.baseUrl = baseUrl;
    const { AIProviderService } = service({ fetch: async (url, init) => {
      assert.equal(String(url), expected);
      assert.equal(JSON.parse(init.body).model, 'configured-model');
      return completion('真实回复');
    } });
    assert.equal(await AIProviderService.generateText(input, { prompt: '测试' }), '真实回复');
    assert.equal(input.openaiCompatible.baseUrl, baseUrl);
  }
});

test('compatible headers merge case-insensitively while the dedicated API key takes precedence', async () => {
  const input = config();
  input.openaiCompatible.customHeaders = {
    authorization: 'Bearer stale-secret', 'content-type': 'application/json; charset=utf-8', 'X-Route': 'custom-route',
  };
  const { AIProviderService } = service({ fetch: async (_url, init) => {
    const entries = Array.from(new Headers(init.headers));
    assert.equal(entries.filter(([name]) => name === 'authorization').length, 1);
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer key-secret');
    assert.equal(new Headers(init.headers).get('content-type'), 'application/json; charset=utf-8');
    assert.equal(new Headers(init.headers).get('x-route'), 'custom-route');
    return completion('ok');
  } });
  assert.equal(await AIProviderService.generateText(input, { prompt: 'test' }), 'ok');
});

test('compatible custom authorization remains usable when no dedicated API key is set', async () => {
  const input = config();
  input.openaiCompatible.apiKey = '';
  input.openaiCompatible.customHeaders = { Authorization: 'Custom custom-secret' };
  const { AIProviderService } = service({ fetch: async (_url, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Custom custom-secret');
    return completion('ok');
  } });
  assert.equal(await AIProviderService.generateText(input, { prompt: 'test' }), 'ok');
});

test('compatible generation and health reject empty or malformed successful responses', async () => {
  for (const body of [{}, null, { choices: [] }, { choices: [{ message: { content: '   ' } }] }, { choices: [{ message: { content: ['invalid'] } }] }]) {
    const { AIProviderService } = service({ fetch: async () => json(body) });
    await assert.rejects(AIProviderService.generateText(config(), { prompt: 'test' }), /文本|回复|响应/);
    const result = await AIProviderService.testProviderHealth('openai_compatible', config());
    assert.equal(result.ok, false);
  }
});

test('compatible health uses a small test output budget instead of the project generation budget', async () => {
  const { AIProviderService } = service({ fetch: async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.ok(payload.max_tokens > 0 && payload.max_tokens <= 64);
    assert.equal(payload.stop, undefined);
    return completion('就绪');
  } });
  assert.equal((await AIProviderService.testProviderHealth('openai_compatible', config())).ok, true);
});

test('invalid endpoint protocols, embedded credentials and blank models fail before any request', async () => {
  for (const provider of ['ollama', 'openai_compatible']) {
    for (const baseUrl of ['', 'not-a-url', 'file:///tmp/model', 'https://user:password@gateway.example/v1']) {
      const input = config(provider);
      input[provider === 'ollama' ? 'ollama' : 'openaiCompatible'].baseUrl = baseUrl;
      const { AIProviderService } = service();
      await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), /地址|URL|凭据|HTTP/i);
    }
  }
  for (const provider of ['gemini', 'ollama', 'openai_compatible']) {
    const input = config(provider);
    input[provider === 'openai_compatible' ? 'openaiCompatible' : provider].model = '  ';
    const { AIProviderService } = service();
    await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), /模型/);
  }
});

test('HTTP failures are actionable and never echo credential-bearing URLs, headers or provider bodies', async () => {
  for (const provider of ['ollama', 'openai_compatible']) {
    const input = config(provider);
    input[provider === 'ollama' ? 'ollama' : 'openaiCompatible'].baseUrl = 'https://gateway.example/v1?key=query-secret';
    input.openaiCompatible.customHeaders = { 'x-api-key': 'header-secret' };
    let calls = 0;
    const { AIProviderService } = service({ fetch: async () => {
      calls++;
      return new Response('key-secret header-secret query-secret body-secret', { status: 401 });
    } });
    await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), error => {
      assert.match(error.message, /401/);
      assert.match(error.message, /密钥|认证|授权/);
      assert.doesNotMatch(error.message, /key-secret|header-secret|query-secret|body-secret|https:\/\//);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('network and invalid JSON failures hide raw exception text', async () => {
  for (const response of [
    () => { throw new Error('connect https://gateway.example?key=query-secret header-secret'); },
    () => new Response('body-secret is not JSON'),
  ]) {
    const { AIProviderService } = service({ fetch: response });
    await assert.rejects(AIProviderService.generateText(config(), { prompt: 'test' }), error => {
      assert.doesNotMatch(error.message, /query-secret|header-secret|body-secret|https:\/\//);
      assert.match(error.message, /网络|连接|JSON|响应/);
      return true;
    });
  }
});

test('generation cancellation covers response body reads and clears deadline timers', async () => {
  for (const provider of ['ollama', 'openai_compatible']) {
    const abort = new AbortController();
    let requestSignal;
    const { AIProviderService, timers } = service({ fetch: async (_url, init) => {
      requestSignal = init.signal;
      queueMicrotask(() => abort.abort('secret cancellation reason'));
      return { ok: true, json: () => new Promise(resolve => setTimeout(() => resolve({
        message: { content: 'too late' }, choices: [{ message: { content: 'too late' } }],
      }), 30)) };
    } });
    await assert.rejects(AIProviderService.generateText(config(provider), { prompt: 'test', signal: abort.signal }), error => {
      assert.equal(error.name, 'AbortError');
      assert.match(error.message, /取消/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    });
    assert.equal(requestSignal.aborted, true);
    assert.equal(timers.size, 0);
  }
});

test('deadline bounds generation including slow response body reads', async () => {
  for (const provider of ['ollama', 'openai_compatible', 'gemini']) {
    let requestSignal;
    const { AIProviderService, timers } = service({ timerMs: 5,
      fetch: async (_url, init) => {
        requestSignal = init.signal;
        return { ok: true, json: () => new Promise(resolve => setTimeout(() => resolve({
          message: { content: 'too late' }, choices: [{ message: { content: 'too late' } }],
        }), 30)) };
      },
      generateContent: async input => {
        requestSignal = input.config.abortSignal;
        return new Promise(resolve => setTimeout(() => resolve({ text: 'too late' }), 30));
      },
    });
    await assert.rejects(AIProviderService.generateText(config(provider), { prompt: 'test' }), /超时/);
    assert.equal(requestSignal.aborted, true);
    assert.equal(timers.size, 0);
  }
});

test('health tests are bounded and cancelable for every provider', async () => {
  for (const provider of ['ollama', 'openai_compatible', 'gemini']) {
    for (const cancel of [false, true]) {
      const abort = new AbortController();
      const { AIProviderService, timers } = service({ timerMs: 5,
        fetch: async () => {
          if (cancel) queueMicrotask(() => abort.abort());
          return { ok: true, json: () => new Promise(resolve => setTimeout(() => resolve({
            models: [{ name: 'qwen2.5:7b' }], choices: [{ message: { content: 'too late' } }],
          }), 30)) };
        },
        generateContent: async () => {
          if (cancel) queueMicrotask(() => abort.abort());
          return new Promise(resolve => setTimeout(() => resolve({ text: 'too late' }), 30));
        },
      });
      const result = await AIProviderService.testProviderHealth(provider, config(provider), abort.signal);
      assert.equal(result.ok, false);
      assert.match(result.message, cancel ? /取消/ : /超时/);
      assert.equal(timers.size, 0);
    }
  }
});

test('an already canceled request does not reach any provider', async () => {
  const abort = new AbortController();
  abort.abort();
  for (const provider of ['ollama', 'openai_compatible', 'gemini']) {
    let calls = 0;
    const { AIProviderService } = service({ fetch: async () => { calls++; return completion('unexpected'); },
      generateContent: async () => { calls++; return { text: 'unexpected' }; },
    });
    await assert.rejects(AIProviderService.generateText(config(provider), { prompt: 'test', signal: abort.signal }), error => error.name === 'AbortError');
    assert.equal(calls, 0);
  }
});

test('Ollama normalizes root, API and full endpoint inputs consistently for generation and health', async () => {
  for (const baseUrl of ['http://localhost:11434', ' http://localhost:11434/api/ ', 'http://localhost:11434/api/chat?token=local']) {
    const input = config('ollama');
    input.ollama.baseUrl = baseUrl;
    const urls = [];
    const { AIProviderService } = service({ fetch: async (url, init) => {
      urls.push(new URL(url).pathname);
      if (init.method === 'GET') return json({ models: [{ name: 'qwen2.5:7b', model: 'qwen2.5:7b' }] });
      assert.equal(JSON.parse(init.body).model, 'qwen2.5:7b');
      return json({ message: { role: 'assistant', content: '本地回复' }, done: true });
    } });
    assert.equal(await AIProviderService.generateText(input, { prompt: 'test' }), '本地回复');
    assert.equal((await AIProviderService.testProviderHealth('ollama', input)).ok, true);
    assert.deepEqual(urls, ['/api/chat', '/api/tags']);
  }
});

test('Ollama health rejects malformed catalogs and an unavailable selected model', async () => {
  for (const body of [{}, { models: 'invalid' }, { models: [] }, { models: [{ name: 'another-model:latest' }] }]) {
    const { AIProviderService } = service({ fetch: async () => json(body) });
    const result = await AIProviderService.testProviderHealth('ollama', config('ollama'));
    assert.equal(result.ok, false);
    assert.match(result.message, /模型|响应/);
  }
});

test('Ollama accepts the implicit latest tag and rejects empty generated text', async () => {
  const input = config('ollama');
  input.ollama.model = 'local-model';
  const { AIProviderService } = service({ fetch: async (_url, init) => init.method === 'GET'
    ? json({ models: [{ name: 'local-model:latest' }] })
    : json({ message: { role: 'assistant', content: '' }, done: true }),
  });
  assert.equal((await AIProviderService.testProviderHealth('ollama', input)).ok, true);
  await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), /文本|回复/);
});

test('Gemini generation and health honor the selected model, cancellation and single-attempt requests', async () => {
  const calls = [];
  const { AIProviderService, timers } = service({ generateContent: async input => {
    calls.push(input);
    assert.equal(input.model, 'gemini-2.5-pro');
    assert.ok(input.config.abortSignal instanceof AbortSignal);
    assert.equal(input.config.httpOptions.retryOptions.attempts, 1);
    return { text: 'Gemini 真实回复' };
  } });
  assert.equal(await AIProviderService.generateText(config('gemini'), { prompt: 'test' }), 'Gemini 真实回复');
  assert.equal((await AIProviderService.testProviderHealth('gemini', config('gemini'))).ok, true);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].config.maxOutputTokens <= 256);
  assert.equal(timers.size, 0);
});

test('Gemini 2.5 Pro maps legacy disabled thinking to its supported minimum without raising output caps', async () => {
  for (const model of ['gemini-2.5-pro', 'gemini-2.5-pro-preview-06-05']) {
    const input = config('gemini');
    input.gemini.model = model;
    const { AIProviderService } = service({ generateContent: async request => {
      assert.equal(request.model, model);
      assert.equal(request.config.thinkingConfig.thinkingBudget, 128);
      assert.equal(request.config.maxOutputTokens, 1500);
      return { text: 'Pro reply' };
    } });
    assert.equal(await AIProviderService.generateText(input, { prompt: 'test', thinkingBudget: 0 }), 'Pro reply');
  }
});

test('Gemini preserves explicit supported Pro budgets and disabled Flash thinking', async () => {
  for (const [model, budget] of [
    ['gemini-2.5-pro', 128], ['gemini-2.5-pro', 512], ['gemini-2.5-pro', -1], ['gemini-2.5-flash', 0],
  ]) {
    const input = config('gemini');
    input.gemini.model = model;
    input.gemini.thinkingBudget = budget;
    const { AIProviderService } = service({ generateContent: async request => {
      assert.equal(request.config.thinkingConfig.thinkingBudget, budget);
      assert.equal(request.config.maxOutputTokens, 1500);
      return { text: 'reply' };
    } });
    assert.equal(await AIProviderService.generateText(input, { prompt: 'test' }), 'reply');
  }
});

test('Gemini Pro health reserves output above the minimum thinking budget while Flash stays cheap', async () => {
  for (const [model, thinkingBudget, maxOutputTokens] of [
    ['gemini-2.5-pro', 128, 256], ['gemini-2.5-pro-preview-06-05', 128, 256], ['gemini-2.5-flash', 0, 64],
  ]) {
    const input = config('gemini');
    input.gemini.model = model;
    const { AIProviderService } = service({ generateContent: async request => {
      assert.equal(request.config.thinkingConfig.thinkingBudget, thinkingBudget);
      assert.equal(request.config.maxOutputTokens, maxOutputTokens);
      return { text: '就绪' };
    } });
    assert.equal((await AIProviderService.testProviderHealth('gemini', input)).ok, true);
  }
});

test('Gemini Pro rejects explicit output caps that leave no room after thinking before calling the provider', async () => {
  for (const [thinkingBudget, maxTokens] of [[0, 0], [0, 64], [0, 128], [512, 256], [512, 512]]) {
    const input = config('gemini');
    input.gemini.thinkingBudget = thinkingBudget;
    input.sampling.maxTokens = maxTokens;
    let calls = 0;
    const { AIProviderService } = service({ generateContent: async () => { calls++; return { text: 'unexpected' }; } });
    await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), /输出.*限制|输出.*上限/);
    assert.equal(calls, 0);
  }
});

test('Gemini Pro with an absent thinking budget uses its supported minimum for small output caps', async () => {
  for (const model of ['gemini-2.5-pro', 'publishers/google/models/gemini-2.5-pro']) {
    const input = config('gemini');
    input.gemini.model = model;
    delete input.gemini.thinkingBudget;
    input.sampling.maxTokens = 256;
    const { AIProviderService } = service({ generateContent: async request => {
      assert.equal(request.model, model);
      assert.equal(request.config.thinkingConfig.thinkingBudget, 128);
      assert.equal(request.config.maxOutputTokens, 256);
      return { text: 'Pro reply' };
    } });
    assert.equal(await AIProviderService.generateText(input, { prompt: 'test' }), 'Pro reply');
  }
});

test('Gemini Pro with an absent thinking budget rejects output caps at the minimum before calling the provider', async () => {
  for (const model of ['gemini-2.5-pro', 'publishers/google/models/gemini-2.5-pro']) {
    const input = config('gemini');
    input.gemini.model = model;
    delete input.gemini.thinkingBudget;
    input.sampling.maxTokens = 128;
    let calls = 0;
    const { AIProviderService } = service({ generateContent: async () => { calls++; return { text: 'unexpected' }; } });
    await assert.rejects(AIProviderService.generateText(input, { prompt: 'test' }), /输出.*上限|输出.*限制/);
    assert.equal(calls, 0);
  }
});

test('Gemini rejects empty replies and hides credential-bearing SDK errors', async () => {
  for (const generateContent of [async () => ({ text: '   ' }), async () => { throw new Error('environment-secret https://api.example?key=secret'); }]) {
    const { AIProviderService } = service({ generateContent });
    await assert.rejects(AIProviderService.generateText(config('gemini'), { prompt: 'test' }), error => {
      assert.doesNotMatch(error.message, /environment-secret|https:\/\/|key=secret/);
      return true;
    });
    assert.equal((await AIProviderService.testProviderHealth('gemini', config('gemini'))).ok, false);
  }
});
