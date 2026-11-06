const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const site = path.resolve(__dirname, '../site');
const Data = require('../site/engine/prefab-data.js');
const manifest = require('../site/data/native-prefabs/manifest.json');
const refs = require('./fixtures/prefab-references.json');
let reads = 0;
const data = new Data(manifest, {
  fetchFile: async (file) => {
    reads++;
    return fs.readFileSync(path.join(site, file));
  },
});
(async () => {
  for (const ref of refs) {
    const before = reads;
    const [a, b] = await Promise.all([data.load(ref.path), data.load(ref.path)]);
    assert.equal(reads - before, 1, 'Concurrent loads share a single HTTP-equivalent read');
    assert.equal(a, b);
    assert.deepEqual(a.meta, ref.metadata);
    assert.equal(
      crypto
        .createHash('sha256')
        .update(new Uint8Array(a.view.buffer, a.view.byteOffset, a.view.byteLength))
        .digest('hex'),
      ref.blocksSha256,
    );
  }
  const broken = new Data(manifest, { fetchFile: async () => new Uint8Array(12) });
  await assert.rejects(broken.load(refs[0].path), /ATPF/);
  console.log({
    nativePrefabReferences: refs.length,
    oneRequestPerPrefab: true,
    concurrentRequestDeduplication: true,
    blocksAndMetadataPreserved: true,
  });
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
