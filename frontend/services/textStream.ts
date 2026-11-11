/** Parse only text deltas; never expose raw provider error payloads. */
export async function readTextStream(response: Response, format: 'sse' | 'ndjson', onText: (delta: string) => void, signal?: AbortSignal): Promise<string> {
  if (!response.body) throw new Error('流式响应没有正文。');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', text = '', complete = false, event = '';
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  const check = () => { if (signal?.aborted) throw new Error('生成已取消。'); };
  const accept = (payload: string) => {
    check(); if (complete) return;
    if (payload.trim() === '[DONE]') { complete = true; return; }
    let item: any; try { item = JSON.parse(payload); } catch { throw new Error('流式响应格式无效。'); }
    if (item.error || event === 'error') throw new Error('模型流式响应失败，请重试。');
    const delta = format === 'sse' ? item.choices?.[0]?.delta?.content : item.message?.content ?? item.response;
    if (delta !== undefined && delta !== null && typeof delta !== 'string') throw new Error('流式文本格式无效。');
    if (delta) { text += delta; if (text.length > 500000) throw new Error('生成文本超过单次上限。'); onText(delta); check(); }
    if (format === 'ndjson' && item.done === true) complete = true;
    if (format === 'sse' && item.choices?.some((c: any) => c.finish_reason)) {
      if (item.choices.some((c: any) => ['content_filter', 'error'].includes(c.finish_reason))) throw new Error('模型没有完成有效正文。');
      complete = true;
    }
  };
  const consume = (flush = false) => {
    if (format === 'ndjson') {
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) accept(line);
      if (flush && buffer.trim()) { accept(buffer); buffer = ''; }
    } else {
      // Normalize complete CRLF pairs, retaining a trailing CR until its next chunk arrives.
      buffer = buffer.replace(/\r\n/g, '\n');
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); event = '';
        const lines = frame.split('\n'); event = lines.find(l => l.startsWith('event:'))?.slice(6).trim() || '';
        const data = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (event === 'error') throw new Error('模型流式响应失败，请重试。');
        if (data) accept(data);
      }
    }
    if (buffer.length > 2097152) throw new Error('流式响应分段过大。');
  };
  try {
    check();
    while (!complete) { const item = await reader.read(); check(); if (item.done) break; buffer += decoder.decode(item.value, { stream: true }); consume(); }
    buffer += decoder.decode(); consume(true); check();
    if (!complete) throw new Error('流式生成中断，正文未完整返回，请重试。');
    if (!text.trim()) throw new Error('模型未返回有效文本。');
    return text;
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
