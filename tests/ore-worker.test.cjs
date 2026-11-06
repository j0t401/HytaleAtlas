const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert/strict');
const root = path.resolve(__dirname, '../site'),
  messages = [],
  reads = [];
const s = {
  structuredClone,
  console,
  WebAssembly,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Map,
  Set,
  BigInt,
  Math,
  Promise,
  setTimeout,
  TextDecoder,
  performance,
  Blob,
  Response,
  DecompressionStream,
  fetch: async (p) => {
    reads.push(p);
    const b = fs.readFileSync(path.join(root, p));
    return {
      ok: true,
      arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    };
  },
  postMessage: (m, transfer = []) => {
    const message = structuredClone(m, { transfer });
    message.publishedAt = performance.now();
    messages.push(message);
  },
};
s.globalThis = s;
const c = vm.createContext(s);
s.importScripts = (...names) =>
  names.forEach((n) => vm.runInContext(fs.readFileSync(path.join(root, n), 'utf8'), c));
vm.runInContext(fs.readFileSync(path.join(root, 'poi-worker.js'), 'utf8'), c);
async function wait(fn) {
  const end = Date.now() + 60000;
  while (!fn()) {
    const e = messages.find((m) => m.type === 'error');
    if (e) throw Error(e.message);
    if (Date.now() > end) throw Error('timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}
(async () => {
  await wait(() => messages.some((m) => m.type === 'catalog'));
  const types = messages.find((m) => m.type === 'catalog').types;
  assert(
    types
      .find((t) => t.key === 'ore:Thorium')
      .oreGuide.depositZones.every((z) => z.startsWith('Zone2')),
  );
  const seedState = vm.runInContext(
    "k.setSeed('12345');({datasetId,seed32:k.seed,unique:k.unique})",
    c,
  );
  vm.runInContext("k.searchUnique=()=>{throw Error('Duplicate climate search')}", c);
  const start = performance.now();
  s.onmessage({
    data: {
      seed: '12345',
      seedState,
      generation: 1,
      revision: 1,
      types: ['ore:Thorium'],
      regions: [{ x: 128, z: 5120, size: 128 }],
    },
  });
  await wait(() =>
    messages.some(
      (m) => m.type === 'region' && m.partial && m.points.some((p) => p.source === 'ore-deposit'),
    ),
  );
  const early = messages.find(
    (m) => m.type === 'region' && m.partial && m.points.some((p) => p.source === 'ore-deposit'),
  );
  assert(early.points.every((p) => p.key === 'ore:Thorium' && !p.confirmed));
  await wait(() => messages.some((m) => m.type === 'region' && !m.partial));
  assert(
    !reads.some(
      (p) => p.endsWith('.apf') || p === 'engine/worldgen.json.gz' || p === 'engine/caves.json.gz',
    ),
  );
  vm.runInContext(
    "oreDeposits.query=()=>{throw Error('Cached deposits recalculated')};surface.collect=()=>{throw Error('Cached surface recalculated')}",
    c,
  );
  s.onmessage({
    data: {
      seed: '12345',
      generation: 1,
      revision: 2,
      types: ['ore:Thorium'],
      regions: [{ x: 128, z: 5120, size: 128 }],
    },
  });
  await wait(() => messages.some((m) => m.type === 'region' && m.revision === 2 && !m.partial));
  console.log({
    nativeThoriumPoints: early.points.length,
    firstNativeMs: early.publishedAt - start,
    completedRegionMs: performance.now() - start,
    noFullVoxelDataDownloaded: true,
    cachedQueryReused: true,
    errors: 0,
  });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
