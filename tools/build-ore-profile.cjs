/** Build native ore-source metadata. Do not infer locations from biome names. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const K = require('../site/engine/core.js');
const site = path.resolve(__dirname, '../site');
const read = (file) =>
  JSON.parse(
    file.endsWith('.gz')
      ? zlib.gunzipSync(fs.readFileSync(path.join(site, file)))
      : fs.readFileSync(path.join(site, file), 'utf8'),
  );
const raw = read('engine/caves.json.gz');
const caves = K.decodeGraph(raw).data;
const world = K.decodeGraph(read('engine/worldgen.json.gz')).data;
const rules = read('data/world-rules.json');
const contents = read('data/poi-contents.json.gz');
const labels = read('data/display-names.json');
const ores = new Map();
for (const value of Object.values(rules.catalog.resources))
  if (value.kind === 'ore' && !ores.has(value.key))
    ores.set(value.key, {
      key: value.key,
      name: labels[value.key] || value.name,
      zones: new Set(),
      depositZones: new Set(),
      prefabZones: new Set(),
    });
const oreKey = (block) =>
  rules.catalog.resources[block]?.kind === 'ore' ? rules.catalog.resources[block].key : null;
function fillingKeys(node) {
  return [
    ...new Set(
      (node.fillings?.weighted || [])
        .filter(([, weight]) => weight > 0)
        .map(([block]) => oreKey(block.blockId))
        .filter(Boolean),
    ),
  ];
}
const sources = [];
for (const zone of caves.zones)
  for (const [typeIndex, type] of (zone.caves?.caveTypes || []).entries()) {
    const nodeOres = {},
      seen = new Set();
    const visit = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      const keys = fillingKeys(node);
      if (keys.length) nodeOres[node.name] = keys;
      for (const child of node.children || [])
        for (const [next] of child.types.weighted) visit(next);
    };
    visit(type.entryNodeType);
    const keys = [...new Set(Object.values(nodeOres).flat())];
    if (!keys.length) continue;
    sources.push({
      zone: zone.name,
      typeIndex,
      name: type.name,
      maximumSize: type.maximumSize,
      nodeOres,
      keys,
    });
    for (const key of keys) {
      ores.get(key).zones.add(zone.name);
      ores.get(key).depositZones.add(zone.name);
    }
  }
const canonical = (file) => file.replace(/\.(?:prefab\.json|lpf)$/, '');
for (const zone of world.zones) {
  const ids = [...zone.tiles.weighted.map(([b]) => b.$biome), ...zone.custom.map((b) => b.$biome)];
  for (const id of ids) {
    const biome = world.biomes.find((b) => b.id === id);
    for (const entry of biome?.prefabs?.entries || [])
      for (const [prefab] of entry.prefabs.weighted)
        for (const key of contents.prefabs[canonical(prefab.path)]?.keys || []) {
          if (!ores.has(key)) continue;
          ores.get(key).zones.add(zone.name);
          ores.get(key).prefabZones.add(zone.name);
        }
  }
}
const result = {
  datasetId: raw.datasetId,
  sources,
  ores: [...ores.values()].map((o) => ({
    ...o,
    zones: [...o.zones],
    depositZones: [...o.depositZones],
    prefabZones: [...o.prefabZones],
  })),
  meaning:
    'Native filling geometry gives provisional deposit anchors, not confirmed final blocks. Height ranges are computed per deposit, not copied from Minecraft.',
};
result.revision = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
fs.writeFileSync(path.join(site, 'data/ore-sources.json'), JSON.stringify(result, null, 2) + '\n');
console.log({
  nativeOreSources: sources.length,
  ores: result.ores.map((o) => ({
    key: o.key,
    depositZones: [...new Set(o.depositZones.map((z) => z.split('_')[0]))],
    prefabZones: [...new Set(o.prefabZones.map((z) => z.split('_')[0]))],
  })),
});

// Dedicated ore geometry excludes rooms, decorations and block buffers from the first ore pass.
const referenceNodes = [],
  referenceMap = new Map();
function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (!value || typeof value !== 'object') return value;
  if ('$ref' in value) {
    const old = value.$ref;
    if (!referenceMap.has(old)) {
      referenceMap.set(old, referenceNodes.length);
      referenceNodes.push(null);
      referenceNodes[referenceMap.get(old)] = project(raw.nodes[old]);
    }
    return { $ref: referenceMap.get(old) };
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !['fillings', 'covers', 'prefabContainer', 'blockMask', 'fluidLevel'].includes(key),
      )
      .map(([key, child]) => [key, project(child)]),
  );
}
const projectedZones = raw.zones.map((zone) => {
  const generator = zone.caves && raw.nodes[zone.caves.$ref],
    allowed = new Set(sources.filter((s) => s.zone === zone.name).map((s) => s.typeIndex));
  return {
    ...zone,
    caves: generator
      ? { caveTypes: generator.caveTypes.map((ref, index) => (allowed.has(index) ? ref : null)) }
      : null,
  };
});
const mini = project({ version: raw.version, datasetId: raw.datasetId, zones: projectedZones });
mini.nodes = referenceNodes;
const miniBytes = zlib.gzipSync(Buffer.from(JSON.stringify(mini)), { level: 9 });
fs.writeFileSync(path.join(site, 'engine/ore-kernel.json.gz'), miniBytes);
console.log({ oreGeometryGzipBytes: miniBytes.length, oreGeometryNodes: referenceNodes.length });
