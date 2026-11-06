const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert/strict');
const root = path.resolve(__dirname, '../site'),
  dbs = new Map();
let writes = 0;
const indexedDB = {
  open: (name) => {
    const r = {};
    setTimeout(() => {
      let fresh = !dbs.has(name);
      if (fresh) dbs.set(name, new Map());
      const data = dbs.get(name);
      r.result = {
        createObjectStore() {},
        transaction() {
          return {
            objectStore() {
              return {
                get(key) {
                  const q = {};
                  setTimeout(() => {
                    q.result = data.has(key) ? structuredClone(data.get(key)) : undefined;
                    q.onsuccess?.();
                  }, 0);
                  return q;
                },
                put(value, key) {
                  writes++;
                  data.set(key, structuredClone(value));
                  return {};
                },
              };
            },
          };
        },
      };
      if (fresh) r.onupgradeneeded?.();
      r.onsuccess?.();
    }, 0);
    return r;
  },
};
function start() {
  const messages = [],
    reads = [];
  const s = {
    structuredClone,
    console,
    WebAssembly,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Map,
    Set,
    BigInt,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
    TextDecoder,
    AbortController,
    performance,
    Blob,
    Response,
    DecompressionStream,
    indexedDB,
    fetch: async (p) => {
      reads.push(p);
      const b = fs.readFileSync(path.join(root, p));
      return {
        ok: true,
        arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      };
    },
    postMessage: (m, transfer = []) => messages.push(structuredClone(m, { transfer })),
  };
  s.globalThis = s;
  const c = vm.createContext(s);
  s.importScripts = (...files) =>
    files
      .filter((f) => !(process.argv.includes('--baseline') && f.endsWith('compiled-noise.js')))
      .forEach((f) =>
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f }),
      );
  vm.runInContext(fs.readFileSync(path.join(root, 'worker.js'), 'utf8'), c);
  return { s, c, messages, reads };
}
async function wait(w, fn) {
  const end = Date.now() + 30000;
  while (!fn()) {
    const e = w.messages.find((m) => m.type === 'error');
    if (e) throw Error(e.message);
    if (Date.now() > end) throw Error('timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}
(async () => {
  const a = start();
  await a.s.onmessage({ data: { type: 'seed', generation: 1, seed: '42' } });
  const task = { key: 'strata-cache', x: 3200, z: -2200, step: 16, n: 32 };
  const t = performance.now();
  await a.s.onmessage({ data: { type: 'view', generation: 1, tasks: [task] } });
  await wait(a, () => a.messages.some((m) => m.type === 'tile' && !m.preview));
  const first = a.messages.find((m) => m.type === 'tile' && !m.preview);
  assert.equal(first.strataOffsets.length, 1025);
  assert(first.strataValues.length >= 2048);
  assert(writes > 0);
  const ms = performance.now() - t;
  const b = start();
  await b.s.onmessage({ data: { type: 'seed', generation: 1, seed: '42' } });
  vm.runInContext("kernel.at=()=>{throw Error('Cached tile regenerated')}", b.c);
  await b.s.onmessage({ data: { type: 'view', generation: 1, tasks: [{ ...task }] } });
  await wait(b, () => b.messages.some((m) => m.type === 'tile' && !m.preview));
  const saved = b.messages.find((m) => m.type === 'tile' && !m.preview);
  assert.deepEqual(Array.from(saved.strataValues), Array.from(first.strataValues));
  assert(!a.reads.some((p) => p.includes('caves.json') || p.endsWith('.binz')));
  const report = {
    surfaceAndAllStrataTogether: true,
    noCaveOrBlockDataLoaded: true,
    persistentTileRestoredWithoutGeneration: true,
    samples: first.ids.length,
    firstTileMs: ms,
    scope: 'Node worker VM with an IndexedDB test double; not a browser benchmark.',
  };
  console.log(report);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
