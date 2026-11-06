const fs = require('node:fs'),
  path = require('node:path'),
  zlib = require('node:zlib'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../site'),
  K = require('../site/engine/core.js');
for (const name of ['terrain', 'materials', 'compiled-noise'])
  require(path.join(root, 'engine', name + '.js'))(K);
const read = async (file) => {
  const b = fs.readFileSync(path.join(root, file));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
(async () => {
  const raw = JSON.parse(
      zlib.gunzipSync(fs.readFileSync(path.join(root, 'engine/poi-kernel.json.gz'))),
    ),
    mapRaw = await require('../site/engine/graph-data.js').load('engine/map-kernel.json', read);
  mapRaw.datasetId = raw.datasetId;
  const hash = new WebAssembly.Instance(new WebAssembly.Module(await read('engine/hash64.wasm')))
      .exports,
    main = new K(mapRaw, hash),
    independent = new K(raw, hash);
  main.setSeed('12345');
  independent.setSeed('12345');
  assert.deepEqual(
    main.unique,
    independent.unique,
    'The climate-only and POI profiles must agree before sharing seed state',
  );
  const state = structuredClone({
      datasetId: raw.datasetId,
      seed32: main.seed,
      unique: main.unique,
    }),
    adopted = new K(raw, hash);
  adopted.searchUnique = () => {
    throw Error('Climate search was repeated');
  };
  adopted.terrainCache = new Map([['stale', {}]]);
  adopted.setSeed('12345', state);
  assert.deepEqual(adopted.unique, independent.unique);
  assert.equal(adopted.terrainCache.size, 0);
  for (const [x, z] of [
    [0, 0],
    [162, 5176],
    [-3330, 5491],
    [10000, -4000],
  ])
    assert.deepEqual(adopted.at(x, z), independent.at(x, z));
  let fallbackCalls = 0;
  adopted.searchUnique = () => {
    fallbackCalls++;
    return { x: 0, y: 0, score: 0 };
  };
  adopted.setSeed('42', state);
  assert(fallbackCalls > 0, 'A snapshot for another seed must not be adopted');
  console.log({
    climateStateMatchesIndependentSearch: true,
    noDuplicateSearchForValidatedState: true,
    incompatibleSeedFallsBack: true,
    terrainCachesCleared: true,
    errors: 0,
  });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
