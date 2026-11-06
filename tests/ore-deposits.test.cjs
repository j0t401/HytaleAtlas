const fs = require('node:fs'),
  path = require('node:path'),
  zlib = require('node:zlib'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../site'),
  K = require('../site/engine/core.js');
for (const f of ['terrain', 'materials', 'compiled-noise', 'properties3d', 'conditions', 'points'])
  require(path.join(root, 'engine', f + '.js'))(K);
const read = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, p))));
const k = new K(
  read('engine/poi-kernel.json.gz'),
  new WebAssembly.Instance(
    new WebAssembly.Module(fs.readFileSync(path.join(root, 'engine/hash64.wasm'))),
  ).exports,
);
const C = require('../site/engine/caves.js'),
  D = require('../site/engine/ore-deposits.js'),
  profile = require('../site/data/ore-sources.json'),
  c = new C(
    k,
    read('engine/ore-kernel.json.gz'),
    require('../site/data/cave-bounds.json'),
    require('../site/engine/trig.js')(fs.readFileSync(path.join(root, 'engine/trig.bin'))),
  );
for (const ref of require('./fixtures/oracle-caves.json').filter((ref) =>
  ['Thorium', 'Cobalt', 'Copper', 'Iron', 'Gold', 'Silver'].includes(ref.caveName),
)) {
  k.setSeed(ref.seed);
  const type = c.zones.get(ref.zone).caves.caveTypes[ref.caveIndex],
    nodes = c
      .generate(type, ref.x, ref.z)
      .sort((a, b) =>
        (a.type.name + '/' + a.seedOffset).localeCompare(b.type.name + '/' + b.seedOffset),
      );
  const expected = [...ref.nodes].sort((a, b) =>
    (a.name + '/' + a.seedOffset).localeCompare(b.name + '/' + b.seedOffset),
  );
  assert.equal(nodes.length, expected.length);
  for (let i = 0; i < nodes.length; i++) {
    assert.equal(nodes[i].seedOffset, expected[i].seedOffset);
    assert.deepEqual(nodes[i].shape.bounds, expected[i].bounds);
  }
}
k.setSeed('12345');
const start = performance.now(),
  points = new D(k, c, profile).query({ x: 128, z: 5120, size: 128 }, new Set(['ore:Thorium']));
assert(points.length, 'Thorium native geometry must be visible without generating world chunks');
for (const p of points) {
  assert.equal(p.key, 'ore:Thorium');
  assert(p.zone.startsWith('Zone2'));
  assert.equal(p.confirmed, false);
  const [zone, index, x, z, offset] = p.depositId.split('/');
  const type = c.zones.get(zone).caves.caveTypes[Number(index)],
    node = c.generate(type, Number(x), Number(z)).find((n) => n.seedOffset === Number(offset));
  assert(node);
  assert.deepEqual(p.bounds, node.shape.bounds);
  assert(c.replaces(type, node.shape, p.x, p.y, p.z));
}
const thorium = profile.ores.find((o) => o.key === 'ore:Thorium'),
  cobalt = profile.ores.find((o) => o.key === 'ore:Cobalt');
assert(thorium.depositZones.every((z) => z.startsWith('Zone2')));
assert(cobalt.prefabZones.some((z) => z.startsWith('Zone4')));
console.log({
  thoriumNativeDeposits: points.length,
  regionMs: performance.now() - start,
  noChunkOrVoxelGeneration: true,
  cobaltZone4PrefabSource: true,
  errors: 0,
});
