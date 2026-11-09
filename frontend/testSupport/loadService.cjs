const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transform } = require('sucrase');
exports.loadService = function(entry, overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console, Error, TypeError, Date, JSON, crypto: require('node:crypto'), AbortController, structuredClone,
      Blob, File, URL, TextDecoder, TextEncoder, Uint8Array, DataView, ArrayBuffer, DecompressionStream,
      atob, btoa, ...globals,
    }, { filename: file })(name => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : name + '.ts'));
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load(entry);
};
