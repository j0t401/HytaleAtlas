const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
let listeners = {},
  draws = 0,
  fallbacks = 0,
  network = 0,
  img;
const c = vm.createContext({
  fetch: async () => ({ ok: true, json: async () => ({ entries: { 'ore:Thorium': 'ore.png' } }) }),
  Image: class {
    constructor() {
      img = this;
      this.complete = true;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }
    addEventListener(k, fn) {
      listeners[k] = fn;
    }
    set src(v) {
      network++;
      this._src = v;
      this.complete = false;
    }
    get src() {
      return this._src || '';
    }
  },
  document: { querySelectorAll: () => [] },
  schedule() {},
  canvas: {
    width: 64,
    height: 64,
    getContext: () =>
      new Proxy(
        {},
        {
          get: (_, k) =>
            k === 'drawImage' ? () => draws++ : k === 'fillText' ? () => fallbacks++ : () => {},
        },
      ),
  },
});
vm.runInContext(fs.readFileSync(require.resolve('../site/icon-art.js'), 'utf8'), c);
(async () => {
  await vm.runInContext('AtlasIconArt.ready', c);
  vm.runInContext("AtlasIconArt.render(canvas,'ore','ore:Thorium','Rare')", c);
  assert.equal(network, 1);
  assert(fallbacks > 0, 'Loading minerals must retain a visible symbol');
  img.naturalWidth = 64;
  img.naturalHeight = 64;
  img.complete = true;
  listeners.load();
  assert.equal(draws, 1, 'Decoded ore art replaces the loading symbol');
  vm.runInContext("AtlasIconArt.render(canvas,'ore','ore:Thorium','Rare')", c);
  assert.equal(network, 1, 'Sprites reuse their image request');
  console.log({ oreVisibleDuringLoad: true, loadedOrePainted: true, imageRequestReused: true });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
