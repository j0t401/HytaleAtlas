/** Check source syntax, static entry points and all content-addressed prefab references. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'site');
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)],
    );
const scripts = [
  ...walk(site),
  ...walk(path.join(root, 'tools')),
  ...walk(path.join(root, 'tests')),
].filter((file) => /\.(?:c?js)$/.test(file));
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
const pythonFiles = [
  path.join(root, 'serve.py'),
  ...walk(path.join(root, 'tools')),
  ...walk(path.join(root, 'tests')),
].filter((file) => file.endsWith('.py'));
for (const file of pythonFiles) {
  const result = spawnSync(
    'python',
    [
      '-c',
      "import ast,sys; ast.parse(open(sys.argv[1],encoding='utf-8-sig').read(),filename=sys.argv[1])",
      file,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
}
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^\"]*)?)"/g))
  assert(fs.existsSync(path.join(site, ref.split('?')[0])), ref);
const manifest = JSON.parse(
  fs.readFileSync(path.join(site, 'data/native-prefabs/manifest.json'), 'utf8'),
);
assert.equal(manifest.format, 3);
for (const [name, record] of Object.entries(manifest.prefabs)) {
  const file = path.join(site, 'data/native-prefabs', record.data + '.apf');
  assert(fs.existsSync(file), 'Missing prefab ' + name);
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(8);
  try {
    assert.equal(fs.readSync(fd, header, 0, 8, 0), 8);
  } finally {
    fs.closeSync(fd);
  }
  assert.equal(header.toString('ascii', 0, 4), 'ATPF', file);
  assert(header.readUInt32LE(4) > 0 && fs.statSync(file).size > header.readUInt32LE(4) + 8, file);
}
for (const file of [
  'site/engine/worldgen.json.gz',
  'site/engine/caves.json.gz',
  'site/engine/strata.json.gz',
  'site/engine/poi-caves.json.gz',
  'site/engine/poi-kernel.json.gz',
  'site/data/poi-contents.json.gz',
  'site/data/poi-columns.json.gz',
])
  assert(fs.existsSync(path.join(root, file)), file);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).outputDirectory,
  'site',
);
console.log({
  syntaxFiles: scripts.length,
  prefabFiles: Object.keys(manifest.prefabs).length,
  errors: 0,
});

const iconManifest = JSON.parse(
  fs.readFileSync(path.join(site, 'assets/icons/manifest.json'), 'utf8'),
);
for (const file of new Set(Object.values(iconManifest.entries)))
  assert(fs.existsSync(path.join(site, file)), 'Missing local icon ' + file);
assert(fs.existsSync(path.join(site, 'engine/ore-kernel.json.gz')));
assert(fs.existsSync(path.join(site, 'data/ore-sources.json')));
console.log({
  localIcons: new Set(Object.values(iconManifest.entries)).size,
  oreGeometryAvailable: true,
});

const mobProfile = JSON.parse(
  require('node:zlib').gunzipSync(fs.readFileSync(path.join(site, 'data/mob-spawns.json.gz'))),
);
assert.equal(
  mobProfile.datasetId,
  manifest.datasetId,
  'Mob profile extraction must match the world',
);
assert(mobProfile.mobs['mob:Bear_Grizzly'].habitatEnvironments.length > 0);
console.log({ mobTypes: Object.keys(mobProfile.mobs).length, mobProfileAvailable: true });
