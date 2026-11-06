const fs = require('node:fs'),
  path = require('node:path'),
  zlib = require('node:zlib'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../site'),
  K = require(path.join(root, 'engine/core.js'));
for (const f of ['terrain', 'materials', 'compiled-noise'])
  require(path.join(root, 'engine', f + '.js'))(K);
const Graph = require(path.join(root, 'engine/graph-data.js')),
  Strata = require(path.join(root, 'engine/strata.js'));
(async () => {
  const get = async (p) => {
      const b = fs.readFileSync(path.join(root, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
    raw = await Graph.load('engine/map-kernel.json', get),
    k = new K(
      raw,
      new WebAssembly.Instance(new WebAssembly.Module(await get('engine/hash64.wasm'))).exports,
    ),
    strata = new Strata(
      k,
      JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'engine/strata.json.gz')))),
    ),
    refs = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/oracle-layers.json')));
  let comparisons = 0;
  for (const p of refs) {
    k.setSeed(p.seed);
    const values = new Uint16Array(strata.bands(p.x, p.z)),
      offsets = new Uint32Array([0, values.length]);
    for (let y = 0; y < 320; y++) {
      assert.equal(
        Strata.at(offsets, values, 0, y),
        p.environments[y],
        JSON.stringify({ seed: p.seed, x: p.x, z: p.z, y }),
      );
      comparisons++;
    }
  }
  const report = {
    columns: refs.length,
    environmentComparisons: comparisons,
    errors: 0,
    noCaveGeneration: true,
    noBlockGeneration: true,
    allHeightsStored: true,
  };
  console.log(report);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
