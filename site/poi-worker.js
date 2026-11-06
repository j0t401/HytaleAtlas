'use strict';

/** Lightweight prefab anchors; final terrain validity belongs to world-worker. */
importScripts(
  'poi-labels.js',
  'engine/noise2d.js',
  'engine/core.js',
  'engine/terrain.js',
  'engine/random.js',
  'engine/materials.js',
  'engine/compiled-noise.js',
  'engine/noise3d.js',
  'engine/properties3d.js',
  'engine/conditions.js',
  'engine/points.js',
  'engine/surface-prefabs.js',
  'engine/poi-contents.js',
  'engine/caves.js',
  'engine/ore-deposits.js',
  'engine/cave-populate.js',
  'engine/trig.js',
);
let datasetId,
  pending = null,
  running = false,
  k,
  surface,
  contents,
  currentSeed,
  cavePromise,
  columnPromise,
  oreProfile,
  oreDeposits,
  orePromise;
const regions = new Map(),
  caveGraphs = new Map(),
  prefabKeys = new Set();
async function read(path) {
  const r = await fetch(path);
  if (!r.ok) throw Error('HTTP ' + r.status + ' ' + path);
  let b = await r.arrayBuffer();
  if (path.endsWith('.gz'))
    b = await new Response(
      new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();
  return /\.(?:wasm|bin)$/.test(path) ? b : JSON.parse(new TextDecoder().decode(b));
}
const ready = Promise.all([
  read('engine/poi-kernel.json.gz'),
  read('data/native-prefabs/geometry.json'),
  read('data/world-rules.json'),
  read('engine/hash64.wasm'),
  read('data/display-names.json'),
  read('data/poi-contents.json.gz'),
  read('data/ore-sources.json'),
]).then(([raw, geo, rules, wasm, labels, index, oreSources]) => {
  if (raw.datasetId !== rules.datasetId || index.datasetId !== raw.datasetId)
    throw Error('Datos de distinta extracción');
  k = new V1Kernel(raw, new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports);
  surface = new V1SurfacePrefabs(k, geo);
  contents = new V1POIContents(k, index);
  for (const prefab of Object.values(index.prefabs))
    for (const key of prefab.keys) prefabKeys.add(key);
  datasetId = raw.datasetId;
  if (oreSources.datasetId !== datasetId) throw Error('Perfil de minerales incompatible');
  oreProfile = oreSources;
  const types = new Map([
    ['unique:spawn', { key: 'unique:spawn', kind: 'structures', name: 'Punto de aparición' }],
    [
      'structure:portal',
      { key: 'structure:portal', kind: 'structures', name: 'Templos de portal' },
    ],
  ]);
  for (const b of k.biomes.values())
    for (const e of b.prefabs?.entries || [])
      for (const [p] of e.prefabs.weighted)
        if (isStructure(p.path)) {
          const key = structureType(p.path);
          types.set(key, { key, kind: 'structures', name: readableStructure(key) });
        }
  types.set('structure:temple', {
    key: 'structure:temple',
    kind: 'structures',
    name: readableStructure('structure:temple'),
  });
  types.set('container:all', {
    key: 'container:all',
    kind: 'chest',
    name: 'Cofres y contenedores',
  });
  for (const r of Object.values(rules.catalog.resources))
    types.set(r.key, { key: r.key, kind: r.kind, name: labels[r.key] || r.name });
  for (const r of rules.catalog.markerRules) {
    const c = r.choices.filter((x) => x.relativeWeight > 0 && x.mob);
    if (
      !r.manualTrigger &&
      r.maxHorizontalSpawnOffset === 0 &&
      c.length &&
      !c.some((x) => x.flock) &&
      new Set(c.map((x) => x.mob)).size === 1
    )
      types.set('mob:' + c[0].mob, {
        key: 'mob:' + c[0].mob,
        kind: 'mob',
        name: labels['mob:' + c[0].mob] || c[0].mob.replaceAll('_', ' '),
      });
  }
  for (const [key, m] of Object.entries(index.types)) {
    if (types.has(key)) Object.assign(types.get(key), m);
    else if (m.kind) types.set(key, { key, ...m });
  }
  for (const ore of oreProfile.ores) if (types.has(ore.key)) types.get(ore.key).oreGuide = ore;
  for (const type of types.values())
    if (type.kind === 'mob') {
      const role = type.key.slice(4),
        matches = rules.catalog.markerRules.filter((rule) => {
          const choices = rule.choices.filter((c) => c.relativeWeight > 0 && c.mob);
          return (
            !rule.manualTrigger &&
            rule.maxHorizontalSpawnOffset === 0 &&
            choices.length &&
            !choices.some((c) => c.flock) &&
            choices.every((c) => c.mob === role)
          );
        });
      if (matches.length)
        type.spawn = {
          verticalSearch: Math.max(...matches.map((r) => r.maxVerticalSpawnOffset)),
          maxDrop: Math.max(...matches.map((r) => r.maxDropHeight)),
          ruleCount: matches.length,
        };
    }
  postMessage({ type: 'catalog', types: [...types.values()] });
});
ready.catch((e) => postMessage({ type: 'error', message: e.message }));
function isStructure(path) {
  return hasRegionalStructure(path);
}
function wantedPath(path, selected) {
  return (
    (isStructure(path) && selected.has(structureType(path))) || contents.matches(path, selected)
  );
}
function addPlacement(points, path, origin, selected, includeStructure = true) {
  if (includeStructure && isStructure(path) && selected.has(structureType(path)))
    points.push({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      key: structureType(path),
      kind: 'structures',
      source: 'prefab-anchor',
      confirmed: false,
    });
  points.push(...contents.expand(path, origin, selected));
}
async function caveEngine() {
  if (!cavePromise)
    cavePromise = Promise.all([
      read('engine/poi-caves.json.gz'),
      read('data/cave-bounds.json'),
      read('engine/trig.bin'),
    ]).then(([raw, bounds, trig]) => {
      if (raw.datasetId !== datasetId) throw Error('Geometría de otra extracción');
      const c = new V1Caves(k, raw, bounds, createV1Trig(trig));
      for (const z of c.data.zones)
        for (const t of z.caves?.caveTypes || []) {
          const paths = new Set(),
            seen = new Set();
          const visit = (n) => {
            if (!n || seen.has(n)) return;
            seen.add(n);
            for (const p of n.shapeGenerator?.prefabs || []) paths.add(p.path);
            for (const e of n.prefabContainer?.entries || [])
              for (const [p] of e.prefabs.weighted) paths.add(p.path);
            for (const e of n.children || []) for (const [child] of e.types.weighted) visit(child);
          };
          visit(t.entryNodeType);
          t.poiPaths = [...paths];
        }
      const pop = new V1CavePopulate(
        k,
        c,
        { canonical: (path) => contents.canonical(path) },
        null,
        surface.geometry,
        null,
      );
      pop.prefabHeight = async (shape, x, z, ceiling) => {
        const columns = await (columnPromise || (columnPromise = read('data/poi-columns.json.gz'))),
          key = contents.canonical(shape.prefabPath),
          p = columns[key];
        if (!p) throw Error('Faltan alturas de columnas para ' + shape.prefabPath);
        if (!p.columnY)
          p.columnY = new Map(p.map(([x, z, low, high]) => [x + ',' + z, [low, high]]));
        const q = c.rotate(
            [Math.trunc(x - shape.o[0]), 0, Math.trunc(z - shape.o[2])],
            shape.rotation,
          ),
          column = p.columnY.get(q[0] + ',' + q[2]);
        return column ? column[ceiling ? 1 : 0] : -1;
      };
      c.poiPopulate = pop;

      return c;
    });
  return cavePromise;
}
async function oreEngine() {
  if (!orePromise)
    orePromise = Promise.all([read('engine/ore-kernel.json.gz'), read('engine/trig.bin')]).then(
      ([raw, trig]) => {
        if (raw.datasetId !== datasetId) throw Error('Datos de minerales de distinta extracción');
        const caves = new V1Caves(k, raw, { prefabs: {} }, createV1Trig(trig));
        oreDeposits = new V1OreDeposits(k, caves, oreProfile);
        return oreDeposits;
      },
    );
  return orePromise;
}
async function queryRegion(task, selected, partial) {
  const size = task.size || 512;
  const points = [];
  if ([...selected].some((key) => key.startsWith('ore:'))) {
    await oreEngine();
    points.push(...oreDeposits.query(task, selected));
    partial?.(points);
    if ([...selected].every((key) => key.startsWith('ore:') && !prefabKeys.has(key)))
      return [
        ...new Map(points.map((p) => [p.key + '/' + p.x + '/' + p.y + '/' + p.z, p])).values(),
      ];
  }
  const result = surface.collect(0, 0, {
    minX: task.x,
    minZ: task.z,
    maxX: task.x + size - 1,
    maxZ: task.z + size - 1,
    entryAllowed: (e) => e.prefabs.weighted.some(([p]) => wantedPath(p.path, selected)),
  });
  for (const c of result.candidates)
    if (!c.invalidated && wantedPath(c.path, selected))
      addPlacement(points, c.path, { ...c, fitHeightmap: c.pattern.fitHeightmap }, selected);
  for (const u of result.uniques)
    if (wantedPath(u.prefabPath, selected))
      addPlacement(points, u.prefabPath, { ...u, fitHeightmap: u.config.fitHeightmap }, selected);
  partial?.(
    points.filter(
      (p) => p.x >= task.x && p.x < task.x + size && p.z >= task.z && p.z < task.z + size,
    ),
  );
  const caves = await caveEngine();
  for (const zone of caves.data.zones)
    for (const type of zone.caves?.caveTypes || []) {
      if (!type.poiPaths.some((path) => wantedPath(path, selected))) continue;
      const radius = type.maximumSize;
      for (const point of k.collectPoints(
        type.pointGenerator,
        task.x - radius,
        task.z - radius,
        task.x + size - 1 + radius,
        task.z + size - 1 + radius,
      )) {
        const x = Math.floor(point.x),
          z = Math.floor(point.z);
        if (k.at(x, z).zone !== zone.name || !k.condition(type.mapCondition, x, z)) continue;
        const height = k.terrainColumn(x, z).height;
        if (!caves.condition(type.heightCondition, (k.seed - 173220171) | 0, x, height, z))
          continue;
        const graphKey = currentSeed + '/' + zone.name + '/' + type.name + '/' + x + '/' + z;
        let nodes = caveGraphs.get(graphKey);
        if (!nodes) {
          nodes = caves.generate(type, x, z);

          caveGraphs.set(graphKey, nodes);
          while (caveGraphs.size > 1024) caveGraphs.delete(caveGraphs.keys().next().value);
        }
        for (const node of nodes) {
          if (
            !node.poiDecorated &&
            (node.type.prefabContainer?.entries || []).some((e) =>
              e.prefabs.weighted.some(([p]) => wantedPath(p.path, selected)),
            )
          ) {
            await caves.poiPopulate.decorations(type, node);
            node.poiDecorated = true;
          }
          node.prefabs ??= [];
        }
        const graphStructures = new Set();
        for (const node of nodes) {
          if (node.shape.kind !== 'Prefab' || !wantedPath(node.shape.prefabPath, selected))
            continue;
          const path = node.shape.prefabPath,
            key = structureType(path);
          addPlacement(
            points,
            path,
            {
              x: Math.floor(node.shape.o[0]),
              y: Math.floor(node.shape.o[1]),
              z: Math.floor(node.shape.o[2]),
              rotation: node.shape.rotation,
            },
            selected,
            !graphStructures.has(key),
          );
          graphStructures.add(key);
        }
        for (const node of nodes)
          for (const prefab of node.prefabs || [])
            if (wantedPath(prefab.path, selected)) {
              const key = structureType(prefab.path);
              addPlacement(points, prefab.path, prefab, selected, !graphStructures.has(key));
              graphStructures.add(key);
            }
      }
    }
  const unique = new Map();
  for (const p of points)
    if (p.x >= task.x && p.x < task.x + size && p.z >= task.z && p.z < task.z + size)
      unique.set(p.key + '/' + p.x + '/' + p.y + '/' + p.z, p);
  return [...unique.values()];
}
const disk =
  typeof indexedDB === 'undefined'
    ? Promise.resolve(null)
    : new Promise((resolve) => {
        const r = indexedDB.open('atlas-poi-cache-v09', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('regions');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
async function diskRead(key) {
  const db = await disk;
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction('regions').objectStore('regions').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function diskWrite(key, value) {
  const db = await disk;
  if (!db) return;
  try {
    db.transaction('regions', 'readwrite').objectStore('regions').put(value, key);
  } catch {}
}
function regionalCacheKey(seed, task) {
  return [
    'contents-v6',
    oreProfile.revision,
    contents.data.revision || 'legacy',
    datasetId,
    seed,
    task.size || 512,
    task.x,
    task.z,
  ].join('/');
}
async function pump() {
  if (running) return;
  running = true;
  try {
    await ready;
    while (pending) {
      const view = pending;
      pending = null;
      if (currentSeed !== view.seed) {
        k.setSeed(view.seed, view.seedState);
        currentSeed = view.seed;
        regions.clear();
        caveGraphs.clear();
      }
      const selected = new Set(view.types);
      for (const task of view.regions) {
        if (pending) break;
        const key = regionalCacheKey(currentSeed, task);
        let cached = regions.get(key) || (await diskRead(key));
        if (
          (task.size || 512) < 512 &&
          (!cached || [...selected].some((type) => !cached.types.includes(type)))
        ) {
          const parentTask = {
            x: Math.floor(task.x / 512) * 512,
            z: Math.floor(task.z / 512) * 512,
            size: 512,
          };
          const parentKey = regionalCacheKey(currentSeed, parentTask),
            parent = regions.get(parentKey) || (await diskRead(parentKey));
          if (parent) {
            const merged = new Map(
              (cached?.points || []).map((p) => [p.key + '/' + p.x + '/' + p.y + '/' + p.z, p]),
            );
            for (const p of parent.points)
              if (
                p.x >= task.x &&
                p.x < task.x + (task.size || 512) &&
                p.z >= task.z &&
                p.z < task.z + (task.size || 512)
              )
                merged.set(p.key + '/' + p.x + '/' + p.y + '/' + p.z, p);
            cached = {
              types: [...new Set([...(cached?.types || []), ...parent.types])],
              points: [...merged.values()],
            };
          }
        }
        const wanted = new Set([...selected].filter((t) => !cached?.types.includes(t)));
        if (!cached || wanted.size) {
          const points = await queryRegion(task, wanted, (points) =>
              postMessage({
                type: 'region',
                partial: true,
                generation: view.generation,
                revision: view.revision,
                x: task.x,
                z: task.z,
                points,
              }),
            ),
            merged = new Map(
              (cached?.points || []).map((p) => [p.key + '/' + p.x + '/' + p.y + '/' + p.z, p]),
            );
          for (const p of points) merged.set(p.key + '/' + p.x + '/' + p.y + '/' + p.z, p);
          cached = {
            types: [...new Set([...(cached?.types || []), ...selected])],
            points: [...merged.values()],
          };
          regions.set(key, cached);
          diskWrite(key, cached);
          while (regions.size > 256) regions.delete(regions.keys().next().value);
        }
        postMessage({
          type: 'region',
          generation: view.generation,
          revision: view.revision,
          x: task.x,
          z: task.z,
          points: cached.points.filter((p) => selected.has(p.key)),
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } catch (e) {
    postMessage({ type: 'error', message: e.message });
  } finally {
    running = false;
  }
}
onmessage = ({ data }) => {
  pending = data;
  pump();
};
