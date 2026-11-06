'use strict';

/** Schedule optional final-block verification and draw its compact summaries. */
let detailedView = '',
  detailedPending = 0,
  detailedDone = new Set();
let worldWorker = null,
  worldTimer,
  worldChunks = new Map();
function queueIntegration() {
  clearTimeout(worldTimer);
  worldTimer = setTimeout(requestIntegration, 160);
}
function requestIntegration() {
  if (!$('world-objects').checked) {
    if (worldWorker) worldWorker.postMessage({ seed, generation: epoch, chunks: [] });
    return;
  }
  if (!worldWorker) {
    worldWorker = new Worker('world-worker.js?v=0.10.0');
    worldWorker.onmessage = ({ data: d }) => {
      if (d.type === 'error') {
        $('world-status').textContent = 'Error del motor detallado: ' + d.message;
        return;
      }
      if (d.generation !== epoch) return;
      worldChunks.set(seed + '/' + d.chunkX + '/' + d.chunkZ, d);
      detailedDone.add(d.chunkX + '/' + d.chunkZ);
      if (typeof rememberWorldPOIs === 'function') rememberWorldPOIs(d);
      if (detailedPending > 0 && --detailedPending === 0) queueIntegration();
      while (worldChunks.size > 192) worldChunks.delete(worldChunks.keys().next().value);
      $('world-status').textContent = `${worldChunks.size} chunks en caché · cálculo progresivo`;
      schedule();
    };
    worldWorker.onerror = (e) => ($('world-status').textContent = e.message);
  }
  const minX = Math.floor((cx - w / 2 / zoom) / 32),
    maxX = Math.floor((cx + w / 2 / zoom) / 32),
    minZ = Math.floor((cz - h / 2 / zoom) / 32),
    maxZ = Math.floor((cz + h / 2 / zoom) / 32),
    total = (maxX - minX + 1) * (maxZ - minZ + 1),
    viewKey = seed + '/' + minX + '/' + maxX + '/' + minZ + '/' + maxZ;
  if (viewKey !== detailedView) {
    detailedView = viewKey;
    detailedDone.clear();
  }
  const batch = [],
    centerX = Math.floor(cx / 32),
    centerZ = Math.floor(cz / 32),
    maxRadius = Math.max(centerX - minX, maxX - centerX, centerZ - minZ, maxZ - centerZ);
  const add = (x, z) => {
    if (
      batch.length >= 64 ||
      x < minX ||
      x > maxX ||
      z < minZ ||
      z > maxZ ||
      worldChunks.has(seed + '/' + x + '/' + z) ||
      detailedDone.has(x + '/' + z)
    )
      return;
    batch.push([x, z]);
  };
  for (let r = 0; r <= maxRadius && batch.length < 64; r++) {
    if (r === 0) {
      add(centerX, centerZ);
      continue;
    }
    for (let d = -r; d <= r && batch.length < 64; d++) {
      add(centerX + d, centerZ - r);
      add(centerX + d, centerZ + r);
    }
    for (let d = -r + 1; d < r && batch.length < 64; d++) {
      add(centerX - r, centerZ + d);
      add(centerX + r, centerZ + d);
    }
  }
  detailedPending = batch.length;
  worldWorker.postMessage({ seed, generation: epoch, chunks: batch });
  $('world-status').textContent = batch.length
    ? `Verificando ${batch.length} chunks · ${Math.max(0, total - detailedDone.size)} pendientes de esta vista`
    : 'Detalle disponible en caché';
}
function drawIntegration() {
  if (!$('world-objects').checked || typeof paintPOI !== 'function') return;
  const depth = Number($('depth').value);
  const underground = $('stratum').value === 'underground';
  const paint = (point) => {
    if (underground && point.minY === undefined && Math.abs(point.y - depth) > 16) return;
    paintPOI({ ...point, confirmed: true, source: 'final-blocks' });
  };
  for (const [key, chunk] of worldChunks) {
    if (!key.startsWith(seed + '/')) continue;
    const x = (chunk.chunkX * 32 - cx) * zoom + w / 2;
    const z = (chunk.chunkZ * 32 - cz) * zoom + h / 2;
    if (x > w || z > h || x + 32 * zoom < 0 || z + 32 * zoom < 0) continue;
    if ($('show-structures').checked) {
      for (const structure of chunk.structures) {
        if (structure.name === 'Temple' || structure.name === 'Spawn') continue;
        if (/Monuments|Dungeon|Temple|Klops|Mineshaft|Treasure|Scarak/.test(structure.path))
          paint({ ...structure, kind: 'structures' });
      }
    }
    for (const group of chunk.groups) {
      const kind = group.kind === 'wood' ? 'wood' : group.kind === 'ore' ? 'ore' : 'chest';
      if (!$('show-' + kind).checked || (underground && (depth < group.minY || depth > group.maxY)))
        continue;
      paint(group);
    }
    if ($('show-mob').checked)
      for (const marker of chunk.markers) paint({ ...marker, kind: 'mob' });
  }
}
for (const id of ['show-structures', 'show-ore', 'show-wood', 'show-chest', 'show-mob'])
  $(id).onchange = schedule;
$('depth').oninput = () => {
  $('depth-value').textContent = $('depth').value;
  schedule();
};
for (const id of ['stratum', 'world-objects'])
  $(id).onchange = () => {
    schedule();
    queueIntegration();
  };

const surfacePointer = canvas.onpointermove;
canvas.onpointermove = (e) => {
  if (pointer || $('stratum').value === 'surface') {
    surfacePointer(e);
    return;
  }
  clearTimeout(hoverTimer);
  hover++;
  const r = canvas.getBoundingClientRect(),
    p = world(e.clientX - r.left, e.clientY - r.top),
    y = Number($('depth').value),
    t = [...tiles.values()]
      .filter(
        (t) =>
          t.strataOffsets &&
          p.x >= t.x &&
          p.z >= t.z &&
          p.x < t.x + t.n * t.step &&
          p.z < t.z + t.n * t.step,
      )
      .sort((a, b) => a.step - b.step)[0],
    id = t
      ? V1Strata.at(
          t.strataOffsets,
          t.strataValues,
          Math.floor((p.z - t.z) / t.step) * t.n + Math.floor((p.x - t.x) / t.step),
          y,
        )
      : null,
    env = strataCatalog[id];
  $('biome').textContent = env
    ? env.name
        .replace(/^Env_/, '')
        .replace(/^Zone\d_/, '')
        .replaceAll('_', ' ')
    : 'Cargando zona subterránea…';
  $('position').textContent = `X: ${p.x} · Y: ${y} · Z: ${p.z}`;
};

let strataLegendKey = '';
function updateStrataLegend() {
  const box = $('strata-legend');
  if ($('stratum').value !== 'underground') {
    if (strataLegendKey !== 'surface') {
      box.replaceChildren();
      strataLegendKey = 'surface';
    }
    return;
  }
  const ids = new Set();
  for (const t of tiles.values()) {
    const x = (t.x - cx) * zoom + w / 2,
      z = (t.z - cz) * zoom + h / 2,
      size = t.n * t.step * zoom;
    if (x > w || z > h || x + size < 0 || z + size < 0) continue;
    for (const id of t.strataIds || []) ids.add(id);
  }
  const key = [...ids].sort((a, b) => a - b).join('/');
  if (key === strataLegendKey) return;
  strataLegendKey = key;
  box.replaceChildren();
  for (const id of [...ids].slice(0, 24)) {
    const e = strataCatalog[id];
    if (!e) continue;
    const row = document.createElement('div'),
      swatch = document.createElement('span'),
      name = document.createElement('span');
    row.className = 'strata-zone';
    swatch.style.background = e.color;
    name.textContent = e.name
      .replace(/^Env_/, '')
      .replace(/^Zone\d_/, '')
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
    row.append(swatch, name);
    box.appendChild(row);
  }
}
