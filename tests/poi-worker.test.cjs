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
  postMessage: (m, transfer = []) => messages.push(structuredClone(m, { transfer })),
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
  const cat = messages.find((m) => m.type === 'catalog').types;
  assert.equal(cat.filter((t) => t.family === 'golems').length, 7);
  assert(cat.some((t) => t.key === 'wood:Goldenwood' && t.name === 'Goldenwood Log'));
  const started = performance.now(),
    types = ['container:all', 'mob:Golem_Crystal_Earth'];
  s.onmessage({
    data: { seed: '42', generation: 1, revision: 1, types, regions: [{ x: 0, z: -512 }] },
  });
  await wait(() => messages.some((m) => m.type === 'region' && m.partial));
  const firstMs = performance.now() - started,
    partial = messages.find((m) => m.type === 'region' && m.partial),
    golem = partial.points.find(
      (p) =>
        p.key === 'mob:Golem_Crystal_Earth' &&
        p.x === 146.38583374023438 &&
        p.z === -19.048492431640625,
    );
  assert(golem, 'Native temple golem is published before cave geometry');
  assert(
    partial.points.some((p) => p.kind === 'chest'),
    'Chest anchors are published before final blocks',
  );
  assert(partial.points.every((p) => p.source === 'prefab-anchor' && p.confirmed === false));
  await wait(() => messages.some((m) => m.type === 'region' && !m.partial));
  const lastMs = performance.now() - started,
    final = messages.find((m) => m.type === 'region' && !m.partial);
  assert(
    !reads.some(
      (p) => p.endsWith('.binz') || p === 'engine/worldgen.json.gz' || p === 'engine/caves.json.gz',
    ),
  );
  vm.runInContext("surface.collect=()=>{throw Error('cached region recalculated')}", c);
  s.onmessage({
    data: { seed: '42', generation: 1, revision: 2, types, regions: [{ x: 0, z: -512 }] },
  });
  await wait(() => messages.some((m) => m.type === 'region' && m.revision === 2 && !m.partial));
  s.onmessage({
    data: {
      seed: '42',
      generation: 1,
      revision: 3,
      types,
      regions: [{ x: 128, z: -128, size: 128 }],
    },
  });
  await wait(() => messages.some((m) => m.type === 'region' && m.revision === 3 && !m.partial));
  const child = messages.find((m) => m.type === 'region' && m.revision === 3 && !m.partial);
  assert(
    child.points.some((p) => p.key === 'mob:Golem_Crystal_Earth' && p.x === 146.38583374023438),
  );
  const report = {
    firstSurfaceAnchorsMs: firstMs,
    allRegionAnchorsMs: lastMs,
    scope: 'Node VM with local filesystem fetch; not a browser benchmark',
    surfacePoints: partial.points.length,
    allPoints: final.points.length,
    chestsBeforeFinalBlocks: true,
    nativeGolemBeforeCavePass: true,
    noVoxelBuffersDownloaded: true,
    cacheReused: true,
    smallRegionReusesParent: true,
    errors: 0,
  };
  console.log(report);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
