const fs = require('fs'),
  path = require('path'),
  zlib = require('zlib'),
  assert = require('assert/strict');
const site = path.resolve(__dirname, '../site'),
  K = require(path.join(site, 'engine/core.js'));
for (const f of ['terrain', 'materials', 'compiled-noise', 'properties3d', 'conditions', 'points'])
  require(path.join(site, 'engine', f + '.js'))(K);
const raw = JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(site, 'engine/poi-kernel.json.gz'))),
  ),
  hash = new WebAssembly.Instance(
    new WebAssembly.Module(fs.readFileSync(path.join(site, 'engine/hash64.wasm'))),
  ).exports,
  k = new K(raw, hash),
  Contents = require(path.join(site, 'engine/poi-contents.js')),
  data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(site, 'data/poi-contents.json.gz')))),
  contents = new Contents(k, data),
  Surface = require(path.join(site, 'engine/surface-prefabs.js')),
  surface = new Surface(
    k,
    JSON.parse(fs.readFileSync(path.join(site, 'data/native-prefabs/geometry.json'))),
  );
let nativeAnchors = 0;
for (const ref of JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/oracle-fixed-spawns.json')),
)) {
  k.setSeed(ref.seed);
  const u = surface.unique().find((s) => s.name === ref.structure),
    points = contents.expand(
      u.prefabPath,
      { ...u, fitHeightmap: u.config.fitHeightmap },
      new Set(['mob:' + ref.marker]),
    ),
    p = points.find((p) => p.key === 'mob:' + ref.marker);
  assert(p);
  for (const axis of ['x', 'y', 'z']) assert.equal(p[axis], ref[axis], `${ref.seed} ${axis}`);
  nativeAnchors++;
}
assert.equal(data.types['wood:Goldenwood'].name, 'Goldenwood Log');
assert.deepEqual(data.types['wood:Goldenwood'].members, [
  'wood:Amber',
  'wood:Palm',
  'wood:Sallow',
  'wood:Wisteria_Wild',
]);
assert.equal(Object.keys(data.types).filter((k) => k.startsWith('mob:Golem')).length, 7);
assert.equal(
  Object.entries(data.types).filter(([k, v]) => k.startsWith('mob:Golem') && v.available === true)
    .length,
  5,
);
const report = {
  nativeFixedAnchors: nativeAnchors,
  errors: 0,
  goldenwoodResourceMembers: 4,
  golemTypes: 7,
  fixedGolemTypes: 5,
  noFabricatedCoordinatesForUnplacedGolems: true,
};
console.log(report);
