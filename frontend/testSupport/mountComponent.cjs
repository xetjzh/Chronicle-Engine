const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const { transform } = require('sucrase');

// Real TSX and handlers, with mounting hooks and external boundaries replaced.
// This exercises state/props contracts, not browser layout, focus or pointer input.
exports.mountComponent = function(filename, exportName, initialProps, overrides = {}, globals = {}) {
  let props = initialProps, cursor = 0, root, dirty, pending = [];
  const state = [], effects = [];
  const hooks = { ...React,
    useId: () => 'test-title',
    useRef(value) { const i = cursor++; return state[i] || (state[i] = { current: value }); },
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value;
      return [state[i], next => { const value = typeof next === 'function' ? next(state[i]) : next; if (!Object.is(state[i], value)) { state[i] = value; dirty = true; } }]; },
    useEffect(fn, deps) { const i = cursor++, old = effects[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
    useMemo(fn) { cursor++; return fn(); }, useCallback(fn) { cursor++; return fn; },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic' }).code;
    const evaluate = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console, Error, TypeError, structuredClone, AbortController, crypto: require('node:crypto'), setTimeout, clearTimeout, ...globals,
    }, { filename: file });
    evaluate(name => {
      if (name === 'react') return hooks;
      if (name in overrides) return overrides[name];
      if (name.endsWith('/Dialog') || name === './Dialog') return { Dialog: 'dialog' };
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(file), name);
        const candidate = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (candidate) return load(candidate);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  const component = load(path.resolve(filename))[exportName];
  const render = () => { let n = 0; do { if (++n > 20) throw new Error('Unsettled component'); dirty = false; pending = []; cursor = 0; root = component(props); pending.forEach(fn => fn()); } while (dirty); };
  const nodes = () => { const result = []; const visit = x => { if (Array.isArray(x)) return x.forEach(visit); if (x?.props) { result.push(x); visit(x.props.children); } }; visit(root); return result; };
  const text = x => Array.isArray(x) ? x.map(text).join('') : x?.props ? text(x.props.children) : ['string', 'number'].includes(typeof x) ? String(x) : '';
  const find = label => { const matches = nodes().filter(n => n.type === 'button' && (n.props['aria-label'] === label || text(n) === label)); if (matches.length !== 1) throw new Error(`Expected unique button: ${label}`); return matches[0]; };
  render();
  return { nodes, text: () => text(root), render, button: find,
    change(label, value, checked) { const input = nodes().find(n => n.props['aria-label'] === label); if (!input) throw new Error(`Missing input ${label}`); input.props.onChange({ target: { value, checked } }); render(); },
    click(label) { const result = find(label).props.onClick(); render(); return result; },
    replaceProps(next) { props = next; render(); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
    unmount() { effects.forEach(e => e?.cleanup?.()); },
  };
};
