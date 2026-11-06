'use strict';

/** Catalog filters, lazy category controls, sprites and regional POI queries. */
const poiTypes = new Map(),
  poiSelected = new Set(),
  poiPoints = new Map(),
  poiSprites = new Map();
let poiWorker = null,
  poiRevision = 0,
  poiTimer,
  poiCatalogReady = false;
const paintedPointIds = new Set();
let poiHitTargets = [];
function prunePOIs() {
  if (poiPoints.size <= 30000) return;
  const margin = 512,
    left = cx - w / 2 / zoom - margin,
    right = cx + w / 2 / zoom + margin,
    top = cz - h / 2 / zoom - margin,
    bottom = cz + h / 2 / zoom + margin;
  for (const [key, p] of poiPoints) {
    if (poiPoints.size <= 30000) break;
    if (!key.startsWith(seed + '/') || p.x < left || p.x > right || p.z < top || p.z > bottom)
      poiPoints.delete(key);
  }
}
function poiColor(key) {
  const materials = {
    copper: '#d78c54',
    iron: '#c6ced3',
    gold: '#efc95d',
    silver: '#d8e7ef',
    thorium: '#66bb83',
    cobalt: '#577fcc',
    adamantite: '#c95f67',
    mithril: '#68c4cf',
    oak: '#b99460',
    birch: '#e1d2a9',
    redwood: '#b5704c',
    fir: '#739461',
    pine: '#6c9368',
  };
  for (const [name, color] of Object.entries(materials))
    if (key.toLowerCase().includes(name)) return color;
  let h = 0;
  for (const c of key) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `hsl(${(h >>> 0) % 360} 66% 63%)`;
}
function poiSprite(kind, key) {
  const rarity = selectedRarity(poiTypes.get(key) || { key, kind });
  const id = kind + '/' + key + '/' + rarity;
  if (poiSprites.has(id)) return poiSprites.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  if (typeof AtlasIconArt !== 'undefined' && AtlasIconArt.render(c, kind, key, rarity)) {
    poiSprites.set(id, c);
    return c;
  }
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = '#10212fee';
  g.beginPath();
  g.arc(16, 16, 15, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = poiColor(key);
  g.fillStyle = poiColor(key);
  g.lineWidth = 2;
  g.lineJoin = 'round';
  if (kind === 'ore') {
    g.beginPath();
    g.moveTo(16, 5);
    g.lineTo(25, 15);
    g.lineTo(16, 27);
    g.lineTo(7, 15);
    g.closePath();
    g.fill();
    g.strokeStyle = '#12202c';
    g.beginPath();
    g.moveTo(16, 5);
    g.lineTo(16, 27);
    g.moveTo(7, 15);
    g.lineTo(25, 15);
    g.stroke();
  } else if (kind === 'wood') {
    g.fillRect(14, 18, 4, 10);
    g.beginPath();
    g.moveTo(16, 4);
    g.lineTo(26, 22);
    g.lineTo(6, 22);
    g.closePath();
    g.fill();
  } else if (kind === 'mob') {
    if (/bat/i.test(key)) {
      g.beginPath();
      for (const [x, y] of [
        [3, 9],
        [11, 13],
        [16, 9],
        [21, 13],
        [29, 9],
        [25, 23],
        [18, 20],
        [16, 26],
        [14, 20],
        [7, 23],
      ])
        g.lineTo(x, y);
      g.closePath();
      g.fill();
    } else if (/golem/i.test(key)) {
      g.fillRect(11, 5, 10, 8);
      g.fillRect(8, 15, 16, 12);
      g.fillRect(3, 15, 4, 10);
      g.fillRect(25, 15, 4, 10);
      g.fillStyle = '#173b32';
      g.fillRect(13, 8, 2, 2);
      g.fillRect(18, 8, 2, 2);
    } else if (/spider|scorpion/i.test(key)) {
      g.beginPath();
      g.ellipse(16, 16, 5, 8, 0, 0, Math.PI * 2);
      g.fill();
      for (const dy of [-7, -2, 3, 8]) {
        g.beginPath();
        g.moveTo(12, 16 + dy / 2);
        g.lineTo(5, 16 + dy);
        g.moveTo(20, 16 + dy / 2);
        g.lineTo(27, 16 + dy);
        g.stroke();
      }
    } else {
      g.beginPath();
      g.arc(16, 13, 6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(16, 27, 9, Math.PI, 0);
      g.fill();
    }
  } else if (kind === 'chest') {
    g.strokeRect(6, 10, 20, 16);
    g.beginPath();
    g.moveTo(6, 16);
    g.lineTo(26, 16);
    g.stroke();
    g.fillRect(14, 14, 4, 7);
  } else if (key === 'unique:spawn') {
    g.beginPath();
    g.moveTo(9, 28);
    g.lineTo(9, 5);
    g.stroke();
    g.beginPath();
    g.moveTo(10, 5);
    g.lineTo(26, 9);
    g.lineTo(10, 16);
    g.closePath();
    g.fill();
  } else if (key === 'structure:shipwreck') {
    g.beginPath();
    g.moveTo(4, 19);
    g.lineTo(28, 19);
    g.lineTo(23, 27);
    g.lineTo(9, 27);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(16, 5);
    g.lineTo(16, 18);
    g.lineTo(25, 16);
    g.closePath();
    g.stroke();
  } else if (key === 'structure:camp') {
    g.beginPath();
    g.moveTo(16, 5);
    g.lineTo(29, 26);
    g.lineTo(3, 26);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(16, 9);
    g.lineTo(20, 26);
    g.lineTo(12, 26);
    g.closePath();
    g.fill();
  } else if (key === 'structure:dungeon' || key === 'structure:portal') {
    g.beginPath();
    g.arc(16, 13, 8, Math.PI, 0);
    g.lineTo(24, 27);
    g.lineTo(8, 27);
    g.closePath();
    g.stroke();
    g.fillRect(14, 15, 4, 12);
  } else {
    g.beginPath();
    g.moveTo(5, 12);
    g.lineTo(16, 5);
    g.lineTo(27, 12);
    g.closePath();
    g.fill();
    for (const x of [8, 15, 22]) g.fillRect(x, 14, 3, 11);
    g.fillRect(5, 26, 23, 3);
  }
  if (typeof AtlasIconArt !== 'undefined') {
    g.strokeStyle = AtlasIconArt.rarityColor(rarity);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(16, 16, 15, 0, Math.PI * 2);
    g.stroke();
  }
  poiSprites.set(id, c);
  return c;
}
function poiKey(p) {
  return p.key || (p.mob ? 'mob:' + p.mob : p.path ? structureType(p.path) : '');
}
let poiRarityOverrides = {};
try {
  poiRarityOverrides = JSON.parse(localStorage.getItem('atlas-rarities-v1') || '{}');
} catch {}
function selectedRarity(t) {
  return poiRarityOverrides[t.key] || atlasRarity(t);
}
function paintPOI(p) {
  // Cull by the chunk margin before scanning an ore's height histogram.
  if (
    !poiSelected.has(poiKey(p)) &&
    !poiKey(p).startsWith('container:') &&
    poiKey(p) !== 'unique:portal'
  )
    return;
  const margin = 32 * zoom + 20;
  if (
    (p.x - cx) * zoom + w / 2 < -margin ||
    (p.x - cx) * zoom + w / 2 > w + margin ||
    (p.z - cz) * zoom + h / 2 < -margin ||
    (p.z - cz) * zoom + h / 2 > h + margin
  )
    return;

  if (p.kind === 'ore' && typeof projectOrePoint === 'function') {
    p = projectOrePoint(p);
    if (!p) return;
  }
  let key = poiKey(p);
  if (key === 'unique:portal') key = 'structure:portal';
  if (key.startsWith('container:')) key = 'container:all';
  if (!poiSelected.has(key)) return;
  if (p.kind === 'ore' && typeof orePointVisible === 'function' && !orePointVisible(p)) return;
  const t = poiTypes.get(key),
    kind = p.kind || t?.kind || 'structures',
    x = (p.x - cx) * zoom + w / 2,
    z = (p.z - cz) * zoom + h / 2;
  if (x < -20 || x > w + 20 || z < -20 || z > h + 20) return;
  const id = key + '/' + p.x + '/' + p.y + '/' + p.z;
  if (paintedPointIds.has(id)) return;
  paintedPointIds.add(id);
  poiHitTargets.push({ key, p, x, z });
  ctx.drawImage(poiSprite(kind, key), x - 12, z - 12, 24, 24);
  if (p.clusterCount > 1) {
    const text =
      p.clusterCount > 999 ? (p.clusterCount / 1000).toFixed(1) + 'k' : String(p.clusterCount);
    ctx.font = 'bold 9px Segoe UI';
    ctx.fillStyle = '#10212f';
    ctx.fillRect(x + 2, z - 18, Math.max(15, text.length * 6 + 5), 13);
    ctx.fillStyle = '#e8f5ff';
    ctx.fillText(text, x + 5, z - 8);
  }
  if ($('poi-labels').checked) {
    const label = t?.name || p.name || 'Elemento';
    ctx.font = '11px Segoe UI';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#101922';
    ctx.strokeText(label, x + 15, z + 4);
    ctx.fillStyle = '#eef6f1';
    ctx.fillText(label, x + 15, z + 4);
  }
}
// Camera movements reuse the sorted list instead of sorting every cached point per frame.
let poiDataRevision = 0;
let poiRenderOrder = { seed: null, revision: -1, size: -1, points: [] };
function drawSelectedPOIs() {
  paintedPointIds.clear();
  poiHitTargets = [];
  if (
    poiRenderOrder.seed !== seed ||
    poiRenderOrder.revision !== poiDataRevision ||
    poiRenderOrder.size !== poiPoints.size
  ) {
    poiRenderOrder = {
      seed,
      revision: poiDataRevision,
      size: poiPoints.size,
      points: [...poiPoints]
        .filter(([key]) => key.startsWith(seed + '/'))
        .map(([, p]) => p)
        .sort((a, b) => markerRank(poiKey(a), a.kind) - markerRank(poiKey(b), b.kind)),
    };
  }
  const underground = $('stratum').value === 'underground';
  const depth = Number($('depth').value);
  const displayPoints =
    typeof prepareMapPoints === 'function'
      ? prepareMapPoints(poiRenderOrder.points)
      : poiRenderOrder.points;
  for (const point of displayPoints) {
    if (
      underground &&
      (point.minY !== undefined
        ? depth < point.minY || depth > point.maxY
        : Math.abs((point.y || 0) - depth) > 16)
    )
      continue;
    paintPOI(point);
  }
}
function syncPoiGroups() {
  for (const [id, kind] of [
    ['show-structures', 'structures'],
    ['show-ore', 'ore'],
    ['show-wood', 'wood'],
    ['show-chest', 'chest'],
    ['show-mob', 'mob'],
  ]) {
    const all = [...poiTypes.values()].filter((t) => t.kind === kind && t.available !== false),
      count = all.filter((t) => poiSelected.has(t.key)).length;
    $(id).checked = !!count;
    $(id).indeterminate = count > 0 && count < all.length;
  }
  $('structures').checked = poiSelected.has('unique:spawn') || poiSelected.has('structure:portal');
  $('fixed-mobs').checked = [...poiSelected].some((k) => k.startsWith('mob:'));
}
function togglePoiTypes(types, on) {
  if (on && types.some((t) => t.kind === 'ore')) $('world-objects').checked = true;
  for (const t of types)
    if (t.available !== false) {
      if (on) poiSelected.add(t.key);
      else poiSelected.delete(t.key);
    }
  syncPoiGroups();
  renderPoiPicker();
  if (typeof updateOreGuide === 'function') updateOreGuide();
  schedule();
  queueIntegration();
}
// Only expanded categories create icon canvases and item controls.
const poiExpandedGroups = new Set();
function poiMatches(t, query, family, rarity) {
  const words = [
    t.name,
    t.description || '',
    poiFamilyNames[poiFamily(t)],
    poiRarityNames[selectedRarity(t)],
  ]
    .join(' ')
    .toLowerCase();
  return (
    (!family || poiFamily(t) === family) &&
    (!rarity || selectedRarity(t) === rarity) &&
    words.includes(query)
  );
}
function createPoiChoice(t) {
  const row = document.createElement('div');
  row.className = 'poi-row';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'poi-choice';
  button.setAttribute('aria-pressed', String(poiSelected.has(t.key)));
  button.disabled = t.available === false;
  button.title =
    t.available === false
      ? 'Sin marcador fijo en WorldGen V1 de este perfil'
      : t.description || t.name;
  const file = typeof AtlasIconArt !== 'undefined' ? AtlasIconArt.url(t.key, t.kind) : null;
  const icon = document.createElement(file ? 'img' : 'canvas');
  icon.width = icon.height = 32;
  if (file) {
    icon.src = file;
    icon.alt = '';
    icon.loading = 'lazy';
    icon.className = 'item-art rarity-' + selectedRarity(t);
  } else icon.getContext('2d').drawImage(poiSprite(t.kind, t.key), 0, 0, 32, 32);
  const label = document.createElement('span');
  label.textContent = t.name + (t.available === false ? ' · sin ancla fija' : '');
  button.append(icon, label);
  button.onclick = () => togglePoiTypes([t], !poiSelected.has(t.key));
  const select = document.createElement('select');
  select.title = 'Rareza orientativa del Atlas: ' + t.name;
  select.setAttribute('aria-label', select.title);
  for (const [value, name] of Object.entries(poiRarityNames)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = name;
    select.append(option);
  }
  select.value = selectedRarity(t);
  select.onchange = () => {
    poiRarityOverrides[t.key] = select.value;
    try {
      localStorage.setItem('atlas-rarities-v1', JSON.stringify(poiRarityOverrides));
    } catch {}
    renderPoiPicker();
  };
  row.append(button, select);
  return row;
}
function poiGroup(id, title, types, forcedOpen, build) {
  const group = document.createElement('details');
  group.className = 'poi-group';
  group.open = forcedOpen || poiExpandedGroups.has(id);
  const summary = document.createElement('summary');
  const selected = types.filter((t) => poiSelected.has(t.key)).length;
  summary.textContent = title + ' · ' + selected + '/' + types.length;
  if (id.startsWith('family/') && typeof AtlasIconArt !== 'undefined') {
    const file = AtlasIconArt.url('family:' + id.slice(7));
    if (file) {
      const img = document.createElement('img');
      img.src = file;
      img.alt = '';
      img.width = img.height = 24;
      summary.prepend(img);
    }
  }
  group.append(summary);
  let built = false;
  const populate = () => {
    if (built) return;
    built = true;
    const actions = document.createElement('div');
    actions.className = 'poi-actions';
    for (const [label, on] of [
      ['Mostrar grupo', true],
      ['Ocultar grupo', false],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => togglePoiTypes(types, on);
      actions.append(button);
    }
    group.append(actions);
    build(group);
  };
  group.ontoggle = () => {
    if (!forcedOpen) {
      if (group.open) poiExpandedGroups.add(id);
      else poiExpandedGroups.delete(id);
    }
    if (group.open) populate();
  };
  if (group.open) populate();
  return group;
}
function renderPoiPicker() {
  const query = $('poi-search').value.trim().toLowerCase();
  const family = $('poi-category').value;
  const rarity = $('poi-rarity').value;
  const forcedOpen = Boolean(query || family || rarity);
  const list = $('poi-picker');
  list.replaceChildren();
  const matching = [...poiTypes.values()].filter((t) => poiMatches(t, query, family, rarity));
  for (const [kind, name] of Object.entries(poiFamilyNames)) {
    const types = matching.filter((t) => poiFamily(t) === kind);
    if (!types.length) continue;
    const familyGroup = poiGroup('family/' + kind, name, types, forcedOpen, (parent) => {
      for (const [tier, tierName] of Object.entries(poiRarityNames)) {
        const members = types.filter((t) => selectedRarity(t) === tier);
        if (!members.length) continue;
        const rarityGroup = poiGroup(kind + '/' + tier, tierName, members, forcedOpen, (inner) => {
          for (const t of members.sort((a, b) => a.name.localeCompare(b.name)))
            inner.append(createPoiChoice(t));
        });
        rarityGroup.className += ' rarity-' + tier;
        parent.append(rarityGroup);
      }
    });
    list.append(familyGroup);
  }
  $('poi-count').textContent =
    `${poiSelected.size} seleccionados · ${matching.length} tipos · todos los zooms`;
}
function queryPOIs() {
  if (!initialized) return;
  if (!poiWorker) {
    poiWorker = new Worker('poi-worker.js?v=0.11.1');
    poiWorker.onmessage = ({ data: d }) => {
      if (d.type === 'catalog') {
        for (const t of d.types) {
          poiTypes.set(t.key, t);
          if (t.kind === 'structures' && $('show-structures').checked) poiSelected.add(t.key);
        }
        poiCatalogReady = true;
        syncPoiGroups();
        renderPoiPicker();
        if (typeof populateOreGuide === 'function') populateOreGuide();
        queryPOIs();
        return;
      }
      if (d.type === 'error') {
        $('poi-status').textContent = d.message;
        $('status').textContent = 'Consulta incompleta: ' + d.message;
        return;
      }
      if (d.generation !== epoch) return;
      for (const p of d.points) {
        if (
          p.source === 'ore-deposit' &&
          worldChunks.has(seed + '/' + Math.floor(p.x / 32) + '/' + Math.floor(p.z / 32))
        )
          continue;
        poiPoints.set(seed + '/' + p.key + '/' + p.x + '/' + p.y + '/' + p.z, p);
      }
      poiDataRevision++;
      prunePOIs();
      if (typeof updateOreGuide === 'function') updateOreGuide();
      if (d.points.some((p) => p.kind === 'ore') && $('world-objects').checked)
        oldQueueIntegration();
      $('poi-status').textContent =
        `${poiPoints.size} anclas en caché · las de prefab se verifican con bloques finales`;
      schedule();
    };
  }
  if (!poiCatalogReady) return;
  const types = [...poiSelected].filter(
      (k) => k !== 'unique:spawn' && poiTypes.get(k)?.available !== false,
    ),
    regionSize = types.some((k) => ['wood', 'ore'].includes(poiTypes.get(k)?.kind)) ? 128 : 512,
    regions = [];
  for (
    let z = Math.floor((cz - h / 2 / zoom) / regionSize) * regionSize;
    z < cz + h / 2 / zoom;
    z += regionSize
  )
    for (
      let x = Math.floor((cx - w / 2 / zoom) / regionSize) * regionSize;
      x < cx + w / 2 / zoom;
      x += regionSize
    )
      regions.push({ x, z, size: regionSize });
  regions.sort(
    (a, b) =>
      (a.x + regionSize / 2 - cx) ** 2 +
      (a.z + regionSize / 2 - cz) ** 2 -
      ((b.x + regionSize / 2 - cx) ** 2 + (b.z + regionSize / 2 - cz) ** 2),
  );
  poiWorker.postMessage({
    seed,
    seedState: climateSeedState,
    generation: epoch,
    revision: ++poiRevision,
    types,
    regions: types.length ? regions : [],
  });
  $('poi-status').textContent =
    `Consultando ${regions.length} regiones · anclas sin generar bloques`;
}
const oldQueueIntegration = queueIntegration;
queueIntegration = () => {
  oldQueueIntegration();
  clearTimeout(poiTimer);
  poiTimer = setTimeout(queryPOIs, 120);
};
for (const id of ['show-ore', 'show-wood', 'show-chest', 'show-mob']) $(id).checked = false;
$('poi-search').oninput = renderPoiPicker;
for (const id of ['poi-category', 'poi-rarity']) $(id).onchange = renderPoiPicker;
$('poi-labels').onchange = schedule;
$('poi-select-results').onclick = () => {
  const family = $('poi-category').value,
    rarity = $('poi-rarity').value,
    q = $('poi-search').value.trim().toLowerCase();
  togglePoiTypes(
    [...poiTypes.values()].filter(
      (t) =>
        (!family || poiFamily(t) === family) &&
        (!rarity || selectedRarity(t) === rarity) &&
        (
          t.name +
          ' ' +
          (t.description || '') +
          ' ' +
          poiFamilyNames[poiFamily(t)] +
          ' ' +
          poiRarityNames[selectedRarity(t)]
        )
          .toLowerCase()
          .includes(q),
    ),
    true,
  );
};
$('poi-hide-all').onclick = () => {
  poiSelected.clear();
  $('world-objects').checked = false;
  syncPoiGroups();
  renderPoiPicker();
  if (typeof updateOreGuide === 'function') updateOreGuide();
  schedule();
  queueIntegration();
};
for (const [id, kind] of [
  ['show-structures', 'structures'],
  ['show-ore', 'ore'],
  ['show-wood', 'wood'],
  ['show-chest', 'chest'],
  ['show-mob', 'mob'],
])
  $(id).onchange = () => {
    if (kind === 'ore' && $(id).checked) $('world-objects').checked = true;
    for (const t of poiTypes.values())
      if (t.kind === kind && t.available !== false) {
        if ($(id).checked) poiSelected.add(t.key);
        else poiSelected.delete(t.key);
      }
    syncPoiGroups();
    renderPoiPicker();
    schedule();
    queueIntegration();
  };

function rememberWorldPOIs(c) {
  for (const [id, p] of poiPoints)
    if (
      id.startsWith(seed + '/') &&
      p.source === 'ore-deposit' &&
      Math.floor(p.x / 32) === c.chunkX &&
      Math.floor(p.z / 32) === c.chunkZ
    )
      poiPoints.delete(id);
  for (const g of c.groups) {
    const p = {
      ...g,
      confirmed: true,
      source: 'final-blocks',
      name: poiTypes.get(g.key)?.name || 'Recurso',
    };
    poiPoints.set(seed + '/' + g.key + '/' + g.x + '/' + g.y + '/' + g.z, p);
    for (const alias of poiTypes.get(g.key)?.aliases || [])
      poiPoints.set(seed + '/' + alias + '/' + g.x + '/' + g.y + '/' + g.z, { ...p, key: alias });
  }
  for (const m of c.markers) {
    const key = 'mob:' + m.mob;
    poiPoints.set(seed + '/' + key + '/' + m.x + '/' + m.y + '/' + m.z, {
      ...m,
      key,
      kind: 'mob',
      name: poiTypes.get(key)?.name || 'Criatura',
      confirmed: true,
      source: 'final-blocks',
    });
  }
  // Structural overview markers come from the regional pass, not individual dungeon rooms.
  poiDataRevision++;
  prunePOIs();
  if (typeof updateOreGuide === 'function') updateOreGuide();
}

const previousPoiPointer = canvas.onpointermove;
canvas.onpointermove = (e) => {
  if (e.pointerType === 'touch' && !pointer) return;
  if (pointer) {
    previousPoiPointer(e);
    return;
  }
  const r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    z = e.clientY - r.top,
    hit = poiHitTargets.find((h) => (h.x - x) ** 2 + (h.z - z) ** 2 < 225);
  if (!hit) {
    previousPoiPointer(e);
    return;
  }
  hover++;
  clearTimeout(hoverTimer);
  $('biome').textContent = poiTypes.get(hit.key)?.name || 'Elemento del mapa';
  $('position').textContent =
    `X: ${Math.round(hit.p.x)} · Y: ${Math.round(hit.p.y || 0)} · Z: ${Math.round(hit.p.z)} · ${hit.p.confirmed ? 'Calculado con bloques finales' : 'Ancla de prefab'}`;
};

$('structures').onchange = () =>
  togglePoiTypes(
    [...poiTypes.values()].filter((t) => ['unique:spawn', 'structure:portal'].includes(t.key)),
    $('structures').checked,
  );
$('fixed-mobs').onchange = () =>
  togglePoiTypes(
    [...poiTypes.values()].filter((t) => t.kind === 'mob'),
    $('fixed-mobs').checked,
  );
