// Compare the production engine against compact hashes captured from native chunks.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const site = path.resolve(__dirname, '../site');
const references = require('./fixtures/world-hashes.json');
const messages = [];
const sandbox = {
  console,
  WebAssembly,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  Int32Array,
  Float32Array,
  Float64Array,
  Map,
  Set,
  BigInt,
  Math,
  Promise,
  setTimeout,
  clearTimeout,
  TextDecoder,
  performance,
  Blob,
  Response,
  DecompressionStream,
  fetch: async (file) => ({
    ok: true,
    arrayBuffer: async () => {
      const bytes = fs.readFileSync(path.join(site, file));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  }),
  postMessage: (message) => messages.push(message),
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
sandbox.importScripts = (...files) =>
  files.forEach((file) =>
    vm.runInContext(fs.readFileSync(path.join(site, file), 'utf8'), context, { filename: file }),
  );
vm.runInContext(fs.readFileSync(path.join(site, 'world-worker.js'), 'utf8'), context);

function digest(chunk) {
  const bytes = Buffer.allocUnsafe(chunk.blocks.length * 16);
  const fields = [chunk.blocks, chunk.fluids, chunk.environments, chunk.priorities];
  for (let i = 0; i < chunk.blocks.length; i++) {
    for (let field = 0; field < fields.length; field++)
      bytes.writeInt32LE(fields[field][i], i * 16 + field * 4);
  }
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

(async () => {
  await vm.runInContext('ready', context);
  const engine = vm.runInContext('engine', context);
  let phases = 0;
  for (const ref of references) {
    engine.k.setSeed(ref.seed);
    const chunk = engine.world.terrain.generate(ref.chunkX, ref.chunkZ);
    assert.equal(
      digest(chunk),
      ref.hashes.blocks,
      `Terrain ${ref.seed}/${ref.chunkX}/${ref.chunkZ}`,
    );
    await engine.world.caves.populate(chunk);
    assert.equal(digest(chunk), ref.hashes.caves, `Caves ${ref.seed}/${ref.chunkX}/${ref.chunkZ}`);
    await engine.world.structures(chunk);
    assert.equal(
      digest(chunk),
      ref.hashes.prefabs,
      `Prefabs ${ref.seed}/${ref.chunkX}/${ref.chunkZ}`,
    );
    engine.world.water(chunk);
    assert.equal(digest(chunk), ref.hashes.water, `Water ${ref.seed}/${ref.chunkX}/${ref.chunkZ}`);
    sandbox.referenceChunk = chunk;
    const summary = vm.runInContext('summarize(referenceChunk)', context);
    assert(
      !('environments' in summary),
      'The UI must not receive an unused voxel environment array',
    );
    assert(
      summary.structures.every((s) => !('config' in s)),
      'Do not clone static generator graphs into UI summaries',
    );
    for (const group of summary.groups.filter((g) => g.kind === 'ore')) {
      assert.equal(
        Object.values(group.heightCounts).reduce((sum, n) => sum + n, 0),
        group.count,
      );
      for (const [y, [x, z]] of Object.entries(group.levelPositions)) {
        const block = chunk.getBlock(x - ref.chunkX * 32, Number(y), z - ref.chunkZ * 32);
        assert.equal(
          engine.rules.catalog.resources[block]?.key,
          group.key,
          'Each height-specific point must identify an actual native ore block',
        );
      }
    }
    phases += 4;
    console.log(`Matched four native phases: seed ${ref.seed}, chunk ${ref.chunkX}, ${ref.chunkZ}`);
  }
  assert(!messages.some((m) => m.type === 'error'));
  console.log({
    nativeChunks: references.length,
    nativePhaseHashes: phases,
    representedFields: references.length * 327680 * 4 * 4,
    errors: 0,
  });
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
