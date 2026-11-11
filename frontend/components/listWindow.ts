export function listWindow(count: number, scrollTop: number, height: number, rowHeight: number, overscan = 4) {
  const first = Math.max(0, Math.min(Math.max(0, count - 1), Math.floor(Math.max(0, scrollTop) / rowHeight)));
  const start = Math.max(0, first - overscan), end = Math.min(count, first + Math.ceil(height / rowHeight) + overscan);
  return { start, end, top: start * rowHeight, bottom: Math.max(0, count - end) * rowHeight };
}
