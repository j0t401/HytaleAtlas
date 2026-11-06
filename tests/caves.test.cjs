const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  zlib = require('node:zlib');
const root = path.resolve(__dirname, '../site'),
  K = require(path.join(root, 'engine/core.js'));
for (const file of ['terrain', 'materials', 'properties3d'])
  require(path.join(root, 'engine', file + '.js'))(K);
const h = new WebAssembly.Instance(
    new WebAssembly.Module(fs.readFileSync(path.join(root, 'engine/hash64.wasm'))),
  ).exports,
  k = new K(
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'engine/poi-kernel.json.gz')))),
    h,
  ),
  Caves = require(path.join(root, 'engine/caves.js')),
  trig = require(path.join(root, 'engine/trig.js'))(
    fs.readFileSync(path.join(root, 'engine/trig.bin')),
  ),
  caves = new Caves(
    k,
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'engine/poi-caves.json.gz')))),
    JSON.parse(fs.readFileSync(path.join(root, 'data/cave-bounds.json'), 'utf8')),
    trig,
  );
const expected = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/oracle-caves.json'), 'utf8'),
  ),
  limit = Number(process.argv[2] || expected.length);
let cases = 0,
  nodes = 0,
  maxError = 0,
  carvingSamples = 0;
const failures = [];
for (const e of expected.slice(0, limit)) {
  k.setSeed(e.seed);
  try {
    const type = caves.zones.get(e.zone).caves.caveTypes[e.caveIndex],
      actual = caves.generate(type, e.x, e.z).sort((a, b) =>
        (a.type.name + '/' + a.seedOffset).localeCompare(b.type.name + '/' + b.seedOffset, 'en', {
          numeric: false,
        }),
      );
    // Java lexicographic ordering for these ASCII keys.
    actual.sort((a, b) => {
      const x = a.type.name + '/' + a.seedOffset,
        y = b.type.name + '/' + b.seedOffset;
      return x < y ? -1 : x > y ? 1 : 0;
    });
    assert.equal(actual.length, e.nodes.length, `${e.caveName} node count`);
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i],
        b = e.nodes[i];
      assert.equal(a.type.name, b.name);
      assert.equal(a.seedOffset, b.seedOffset);
      assert.deepEqual(a.shape.bounds, b.bounds, `${e.caveName} shape bounds ${b.name}`);
      if (b.rotation) assert.equal(a.shape.rotation, b.rotation);
      if (b.prefabPath) assert.equal(a.shape.prefabPath, b.prefabPath);
      for (const key of ['yaw', 'pitch']) {
        const delta = Math.abs(a[key] - b[key]);
        maxError = Math.max(maxError, delta);
        assert(delta < 1e-10, `${e.caveName} ${key}: ${a[key]} vs ${b[key]}`);
      }
      for (const [key, value] of [
        ['start', a.shape.o],
        ['end', a.shape.end],
      ])
        for (let j = 0; j < 3; j++) {
          const delta = Math.abs(value[j] - b[key][j]);
          maxError = Math.max(maxError, delta);
          assert(delta < 1e-8, `${e.caveName} ${key}[${j}]: ${value[j]} vs ${b[key][j]}`);
        }
      for (const [x, y, z, replace] of []) {
        assert.equal(
          caves.replaces(type, a.shape, x, y, z),
          replace,
          `${e.caveName} carving ${b.name} at ${x},${y},${z}`,
        );
        carvingSamples++;
      }
      nodes++;
    }
    cases++;
    console.log(e.caveName, actual.length, 'nodes matched');
  } catch (error) {
    failures.push({ name: e.caveName, error: String(error.message) });
    console.log('FAILED', e.caveName, error.message);
    if (process.argv.includes('--stop')) throw error;
  }
}
const report = { cases, nodes, carvingSamples, maxError, failures };
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0);
