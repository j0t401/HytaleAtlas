'use strict';
/** Responsive controls and point details. These filters only project cached results. */
const oreNames = {
  Copper: 'Cobre',
  Iron: 'Hierro',
  Silver: 'Plata',
  Gold: 'Oro',
  Thorium: 'Torio',
  Cobalt: 'Cobalto',
  Adamantite: 'Adamantita',
  Mithril: 'Mitrilo',
};
const mobileLayout = matchMedia('(max-width: 760px)');
let activePanel = 'catalog',
  selectedPoint = null,
  guideQueued = false,
  oreResultLimit = 24;
function coordinateText(value) {
  value = Number(value) || 0;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function oreTitle(type) {
  const local = oreNames[type?.key?.split(':')[1]];
  return local ? local + ' · ' + type.name : type?.name || 'Mineral';
}
function zoneLabels(zones) {
  return [
    ...new Set(
      (zones || []).map((zone) => {
        const number = /^Zone(\d+)/.exec(zone)?.[1];
        return number
          ? 'Zona ' +
              number +
              (number === '2' ? ' · desierto' : number === '3' ? ' · región fría' : '')
          : 'Océanos';
      }),
    ),
  ].join(', ');
}
function setSidebar(open) {
  if ($('version').options[0])
    $('version').options[0].label = mobileLayout.matches ? 'V1 · pre.4' : '0.8.0-pre.4 · V1';
  document.body.classList.toggle('panel-collapsed', !open);
  $('toggle-panel').setAttribute('aria-expanded', String(open));
  if (open && mobileLayout.matches) closePoint();
}
function setPanel(name) {
  activePanel = name;
  for (const key of ['catalog', 'layers', 'ores']) {
    $('panel-' + key).hidden = key !== name;
    $('tab-' + key).setAttribute('aria-selected', String(key === name));
    $('tab-' + key).tabIndex = key === name ? 0 : -1;
  }
  if (name === 'ores') updateOreGuide();
}
$('toggle-panel').onclick = () => setSidebar(document.body.classList.contains('panel-collapsed'));
$('close-panel').onclick = () => {
  setSidebar(false);
  $('toggle-panel').focus();
};
for (const [index, key] of ['catalog', 'layers', 'ores'].entries()) {
  $('tab-' + key).onclick = () => setPanel(key);
  $('tab-' + key).onkeydown = (e) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = ['catalog', 'layers', 'ores'][(index + delta + 3) % 3];
    setPanel(next);
    $('tab-' + next).focus();
  };
}
mobileLayout.addEventListener('change', () => setSidebar(!mobileLayout.matches));
setSidebar(!mobileLayout.matches);
$('open-coords').onclick = () => {
  $('coords-popover').hidden = !$('coords-popover').hidden;
  if (!$('coords-popover').hidden) $('x').focus();
};
$('close-coords').onclick = () => {
  $('coords-popover').hidden = true;
  $('open-coords').focus();
};
const goToCoordinates = $('coords').onsubmit;
$('coords').onsubmit = (e) => {
  goToCoordinates(e);
  $('coords-popover').hidden = true;
  if (mobileLayout.matches) setSidebar(false);
};
function oreRange() {
  let min = $('ore-y-enabled').checked ? Number($('ore-y-min').value) : 0,
    max = $('ore-y-enabled').checked ? Number($('ore-y-max').value) : 319;
  min = Math.max(0, Math.min(319, min));
  max = Math.max(0, Math.min(319, max));
  if ($('stratum').value === 'underground') {
    const depth = Number($('depth').value);
    min = Math.max(min, depth);
    max = Math.min(max, depth);
  }
  return { min, max };
}
function orePointVisible(point) {
  if (point.clusterPoints) return true;
  const { min, max } = oreRange();
  if (max < min) return false;
  if (point.heightCounts)
    return Object.entries(point.heightCounts).some(
      ([y, count]) => count > 0 && Number(y) >= min && Number(y) <= max,
    );
  return (point.maxY ?? point.y) >= min && (point.minY ?? point.y) <= max;
}
function projectOrePoint(point) {
  if (point.clusterPoints) return point;
  if (!orePointVisible(point)) return null;
  if (!point.levelPositions || !point.heightCounts) return point;
  const { min, max } = oreRange(),
    levels = Object.keys(point.heightCounts)
      .map(Number)
      .filter((y) => y >= min && y <= max && point.heightCounts[y] > 0)
      .sort((a, b) => a - b);
  if (!levels.length) return null;
  const preferred = $('stratum').value === 'underground' ? Number($('depth').value) : point.y;
  const y = levels.reduce(
    (best, current) =>
      Math.abs(current - preferred) < Math.abs(best - preferred) ? current : best,
    levels[0],
  );
  const [x, z] = point.levelPositions[y];
  return {
    ...point,
    x,
    y,
    z,
    minY: levels[0],
    maxY: levels.at(-1),
    count: levels.reduce((sum, y) => sum + point.heightCounts[y], 0),
  };
}
// World-aligned screen-space groups retain all members and are optional at every zoom.
let mapPointGroups = { signature: '', points: [] };
function prepareMapPoints(points) {
  if (!$('poi-cluster').checked) return points;
  const range = oreRange(),
    step = Math.max(1, Math.ceil(32 / zoom)),
    signature = [poiDataRevision, poiPoints.size, seed, step, range.min, range.max].join('/');
  if (signature === mapPointGroups.signature) return mapPointGroups.points;
  const output = [],
    groups = new Map();
  for (const raw of points) {
    if (raw.kind !== 'ore') {
      output.push(raw);
      continue;
    }
    const point = projectOrePoint(raw);
    if (!point) continue;
    const key = point.key + '/' + Math.floor(point.x / step) + '/' + Math.floor(point.z / step);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  }
  for (const members of groups.values()) {
    if (members.length === 1) {
      output.push(members[0]);
      continue;
    }
    const first = members[0];
    output.push({
      ...first,
      clusterCount: members.length,
      clusterPoints: members,
      source: 'ore-cluster',
      confirmed: members.every((p) => p.confirmed),
      minY: Math.min(...members.map((p) => p.minY ?? p.y)),
      maxY: Math.max(...members.map((p) => p.maxY ?? p.y)),
    });
  }
  output.sort((a, b) => markerRank(poiKey(a), a.kind) - markerRank(poiKey(b), b.kind));
  mapPointGroups = { signature, points: output };
  return output;
}
$('poi-cluster').onchange = schedule;
function populateOreGuide() {
  const select = $('ore-guide-select'),
    previous = select.value;
  select.replaceChildren();
  for (const type of [...poiTypes.values()].filter((t) => t.kind === 'ore')) {
    type.description = [type.description || '', oreNames[type.key.split(':')[1]] || ''].join(' ');
    const option = element('option', null, oreTitle(type));
    option.value = type.key;
    select.append(option);
  }
  if (poiTypes.has(previous)) select.value = previous;
  else
    select.value =
      [...poiSelected].find((key) => key.startsWith('ore:')) ||
      (poiTypes.has('ore:Thorium') ? 'ore:Thorium' : select.options[0]?.value || '');
  updateOreGuide();
}
function updateOreGuide() {
  if (guideQueued) return;
  guideQueued = true;
  requestAnimationFrame(() => {
    guideQueued = false;
    if (!$('panel-ores').hidden) renderOreGuide();
  });
}
function guideRow(label, text) {
  const row = element('div', 'guide-row');
  row.append(element('strong', null, label), element('span', null, text));
  return row;
}
function renderOreGuide() {
  const type = poiTypes.get($('ore-guide-select').value);
  if (!type) return;
  const guide = $('ore-guide');
  guide.replaceChildren();
  const heading = element('div', 'guide-heading'),
    file = typeof AtlasIconArt !== 'undefined' ? AtlasIconArt.url(type.key, type.kind) : null;
  if (file) {
    const image = element('img');
    image.src = file;
    image.alt = '';
    image.width = image.height = 36;
    heading.append(image);
  }
  heading.append(element('h3', null, oreTitle(type)));
  guide.append(heading);
  const profile = type.oreGuide;
  guide.append(
    guideRow(
      'Depósitos del generador',
      profile?.depositZones.length
        ? zoneLabels(profile.depositZones)
        : 'Sin fuente de depósitos ligeros en este perfil.',
    ),
  );
  if (profile?.prefabZones.length)
    guide.append(guideRow('También en prefabs', zoneLabels(profile.prefabZones)));
  guide.append(
    guideRow(
      'Alturas',
      'Cada depósito muestra su intervalo Y calculado. Abre un punto para consultar sus capas y los bloques comprobados.',
    ),
  );
  const visible = [];
  for (const [id, raw] of poiPoints) {
    if (!id.startsWith(seed + '/') || raw.key !== type.key) continue;
    const point = projectOrePoint(raw);
    if (!point) continue;
    const x = (point.x - cx) * zoom + w / 2,
      z = (point.z - cz) * zoom + h / 2;
    if (x >= 0 && x <= w && z >= 0 && z <= h) visible.push(point);
  }
  visible.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - ((b.x - cx) ** 2 + (b.z - cz) ** 2));
  $('ore-result-count').textContent = String(visible.length);
  const results = $('ore-results');
  results.replaceChildren();
  if (visible.length) {
    const min = Math.min(...visible.map((p) => p.minY ?? p.y)),
      max = Math.max(...visible.map((p) => p.maxY ?? p.y));
    guide.append(guideRow('Franjas calculadas en esta vista', 'Y ' + min + ' a ' + max));
  } else
    results.append(
      element(
        'p',
        'note',
        poiSelected.has(type.key)
          ? 'Todavía no hay puntos calculados de este mineral en la vista. Prueba sus zonas de origen o espera la consulta.'
          : 'Pulsa «Mostrar este mineral» para buscar sus depósitos.',
      ),
    );
  for (const point of visible.slice(0, oreResultLimit)) {
    const button = element('button', 'ore-result');
    button.type = 'button';
    const text = element('span', null, 'X ' + Math.round(point.x) + ' · Z ' + Math.round(point.z));
    text.append(
      element(
        'small',
        null,
        'Y ' +
          (point.minY ?? point.y) +
          '–' +
          (point.maxY ?? point.y) +
          (point.confirmed ? ' · ' + point.count + ' bloques' : ''),
      ),
    );
    button.append(
      text,
      element(
        'span',
        'result-badge' + (point.confirmed ? ' confirmed' : ''),
        point.confirmed ? 'Comprobado' : 'Previsto',
      ),
    );
    button.onclick = () => openPoint(point, true);
    results.append(button);
  }
  if (visible.length > oreResultLimit) {
    const more = element(
      'button',
      'subtle',
      'Mostrar más (' + (visible.length - oreResultLimit) + ')',
    );
    more.onclick = () => {
      oreResultLimit += 24;
      updateOreGuide();
    };
    results.append(more);
  }
}
$('ore-guide-select').onchange = () => {
  oreResultLimit = 24;
  updateOreGuide();
};
$('ore-show').onclick = () => {
  const type = poiTypes.get($('ore-guide-select').value);
  if (type) togglePoiTypes([type], true);
};
for (const id of ['ore-y-enabled', 'ore-y-min', 'ore-y-max'])
  $(id).oninput = () => {
    $('ore-y-max').setCustomValidity(
      Number($('ore-y-min').value) > Number($('ore-y-max').value)
        ? 'La altura final debe ser mayor o igual que la inicial.'
        : '',
    );
    schedule();
    updateOreGuide();
  };
const previousDepth = $('depth').oninput;
$('depth').oninput = (e) => {
  previousDepth(e);
  queueCenterProbe();
  updateOreGuide();
};
function closePoint() {
  $('point-details').hidden = true;
  document.body.classList.remove('point-open');
  selectedPoint = null;
}
$('close-point').onclick = closePoint;
function openPoint(point, center = false) {
  selectedPoint = point;
  $('point-copy').textContent = 'Copiar coordenadas';
  $('point-command').textContent = 'Copiar /tp';
  $('point-command').disabled = !Number.isFinite(point.y);
  $('point-depth').disabled = !Number.isFinite(point.y);
  mapPin = point;
  schedule();
  if (mobileLayout.matches) setSidebar(false);
  if (center) {
    cx = clamp(point.x);
    cz = clamp(point.z);
    $('x').value = Math.round(cx);
    $('z').value = Math.round(cz);
    requestView();
  }
  const key = point.key || poiKey(point),
    type = poiTypes.get(key) || {
      key,
      kind: point.kind || 'structures',
      name: point.name || readableStructure(key),
    };
  const isPin = point.kind === 'coordinate';
  const rarity = selectedRarity(type),
    family = poiFamilyNames[poiFamily(type)] || 'Elemento';
  $('point-name').textContent = type.name;
  $('point-category').textContent = isPin
    ? 'Marcador personal'
    : family + ' · ' + poiRarityNames[rarity];
  const icon = typeof AtlasIconArt !== 'undefined' ? AtlasIconArt.url(key, type.kind) : null;
  $('point-icon').src = isPin ? pinIcon : icon || poiSprite(type.kind, key).toDataURL('image/png');
  $('point-details').style.setProperty(
    '--point-rarity',
    typeof AtlasIconArt !== 'undefined' ? AtlasIconArt.rarityColor(rarity) : '#8195a8',
  );
  $('point-state').textContent = isPin
    ? Number.isFinite(point.y)
      ? point.heightSource
      : 'Consultando altura del terreno…'
    : point.clusterPoints
      ? 'Grupo de ' + point.clusterCount + ' resultados'
      : point.confirmed
        ? 'Comprobado con bloques finales'
        : point.source === 'ore-deposit'
          ? 'Depósito previsto · pendiente de verificación'
          : 'Ancla de prefab · condiciones por verificar';
  $('point-state').className = 'point-state' + (point.confirmed ? ' confirmed' : '');
  const information = $('point-information');
  information.replaceChildren();
  const coordinates = element('div', 'point-data');
  for (const axis of ['x', 'y', 'z']) {
    const cell = element('div');
    cell.append(
      element('small', null, axis.toUpperCase()),
      element('strong', null, Number.isFinite(point[axis]) ? coordinateText(point[axis]) : '…'),
    );
    coordinates.append(cell);
  }
  information.append(coordinates);
  if (isPin) {
    information.append(
      element(
        'p',
        'point-note',
        'Punto señalado en el mapa. La altura de superficie corresponde al terreno base; puedes editar Y antes de copiar el comando.',
      ),
    );
  } else if (point.clusterPoints) {
    information.append(
      element(
        'p',
        'point-note',
        point.clusterCount +
          ' puntos próximos agrupados. Las coordenadas corresponden al primer resultado. Puedes abrir un punto individual o desactivar la agrupación.',
      ),
    );
    const list = element('div', 'height-list');
    for (const member of point.clusterPoints.slice(0, 20)) {
      const button = element(
        'button',
        null,
        'Y ' + member.y + ' · X ' + Math.round(member.x) + ' · Z ' + Math.round(member.z),
      );
      button.onclick = () => openPoint(member);
      list.append(button);
    }
    information.append(list);
    const ungroup = element('button', 'subtle', 'Ver todos por separado');
    ungroup.onclick = () => {
      $('poi-cluster').checked = false;
      schedule();
      closePoint();
    };
    information.append(ungroup);
  } else if (point.kind === 'ore') {
    information.append(
      element(
        'p',
        'point-note',
        'Franja ' +
          (point.confirmed ? 'comprobada' : 'de la geometría') +
          ': Y ' +
          (point.minY ?? point.y) +
          ' a ' +
          (point.maxY ?? point.y) +
          '. ' +
          (point.confirmed
            ? 'El punto señala un bloque real del intervalo seleccionado.'
            : 'El terreno, las máscaras y las cuevas pueden modificar el depósito final.'),
      ),
    );
    if (point.zone) information.append(guideRow('Zona', zoneLabels([point.zone])));
    if (point.heightCounts) {
      const heights = element('div', 'height-list');
      for (const y of Object.keys(point.heightCounts)
        .map(Number)
        .sort((a, b) => a - b)) {
        const button = element('button', null, 'Y ' + y + ' · ' + point.heightCounts[y]);
        button.title = 'Mostrar mineral en Y ' + y;
        button.onclick = () => {
          $('ore-y-enabled').checked = true;
          $('ore-y-min').value = $('ore-y-max').value = String(y);
          schedule();
          updateOreGuide();
        };
        heights.append(button);
      }
      const section = element('details', 'height-details');
      section.append(
        element(
          'summary',
          null,
          'Ver todas las alturas (' + Object.keys(point.heightCounts).length + ')',
        ),
        heights,
      );
      information.append(section);
    }
  } else if (type.kind === 'mob') {
    information.append(
      element(
        'p',
        'point-note',
        'Marcador fijo en X/Z. La criatura puede no aparecer si no se cumplen sus condiciones o ya fue derrotada.',
      ),
    );
    if (type.spawn)
      information.append(
        guideRow(
          'Ajuste vertical',
          'Hasta ' +
            type.spawn.verticalSearch +
            ' bloques de búsqueda vertical según las reglas de este tipo.',
        ),
      );
  } else if (type.kind === 'chest')
    information.append(
      element(
        'p',
        'point-note',
        'Contenedor reconocido por su bloque. Este mapa no predice su botín.',
      ),
    );
  else
    information.append(
      element(
        'p',
        'point-note',
        'Ancla de colocación de ' +
          type.name.toLowerCase() +
          '. La altura y orientación corresponden al generador del perfil seleccionado.',
      ),
    );
  const edit = element('label', 'pin-height', 'Altura Y para copiar');
  const input = element('input');
  input.id = 'point-y';
  input.type = 'number';
  input.step = '1';
  input.min = '0';
  input.max = '319';
  input.value = Number.isFinite(point.y) ? String(Math.round(point.y)) : '';
  input.oninput = () => {
    const value = input.value.trim();
    const y = Number(value);
    const valid = value !== '' && Number.isFinite(y) && y >= 0 && y <= 319;
    if (valid) {
      selectedPoint = { ...selectedPoint, y };
      mapPin = selectedPoint;
      coordinates.children[1].children[1].textContent = coordinateText(y);
      pinRequest++;
    }
    $('point-command').disabled = !valid;
    $('point-depth').disabled = !valid;
  };
  edit.append(input);
  information.append(edit);
  $('point-details').hidden = false;
  document.body.classList.add('point-open');
}
$('point-depth').onclick = () => {
  if (!selectedPoint) return;
  const y = Math.max(0, Math.min(319, Math.round(selectedPoint.y || 0)));
  $('stratum').value = 'underground';
  $('depth').value = String(y);
  $('depth-value').textContent = String(y);
  schedule();
  updateOreGuide();
};
function copiedPosition(command = false) {
  if (!selectedPoint) return '';
  const axes = Number.isFinite(selectedPoint.y) ? ['x', 'y', 'z'] : ['x', 'z'];
  if (command && axes.length !== 3) return '';
  return (
    (command ? '/tp ' : '') + axes.map((axis) => coordinateText(selectedPoint[axis])).join(' ')
  );
}
async function copyPosition(command = false) {
  const text = copiedPosition(command);
  if (!text) return;
  const button = $(command ? 'point-command' : 'point-copy');
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = command ? 'Comando copiado' : 'Coordenadas copiadas';
  } catch {
    const field = element('input', 'copy-fallback');
    field.value = text;
    field.readOnly = true;
    field.setAttribute('aria-label', 'Texto para copiar');
    $('point-information').append(field);
    field.focus();
    field.select();
    button.textContent = 'Selecciona y copia el texto';
  }
}
$('point-copy').onclick = () => copyPosition();
$('point-command').onclick = () => copyPosition(true);
let mapPin = null,
  pinRequest = 0,
  pinPlacement = false,
  centerTimer;
const pinIcon =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48"><path d="M20 46C15 37 4 28 4 18a16 16 0 0 1 32 0c0 10-11 19-16 28Z" fill="#7de4c7" stroke="#10212f" stroke-width="3"/><circle cx="20" cy="18" r="6" fill="#10212f"/></svg>',
  );
function clearMapPin() {
  mapPin = null;
  pinRequest++;
  closePoint();
  schedule();
}
$('pin-remove').onclick = clearMapPin;
function placeMapPin(x, z) {
  const underground = $('stratum').value === 'underground';
  const point = {
    key: 'coordinate:pin',
    kind: 'coordinate',
    name: 'Punto señalado',
    x,
    z,
    y: underground ? Number($('depth').value) : null,
    heightSource: underground ? 'Altura de la capa seleccionada' : 'Altura del terreno base',
  };
  const request = ++pinRequest;
  openPoint(point);
  if (!underground && initialized)
    worker.postMessage({ type: 'pin', generation: epoch, request, x, z });
  pinPlacement = false;
  $('pin-mode').setAttribute('aria-pressed', 'false');
  canvas.classList.remove('placing-pin');
}
function receiveMapPin(d) {
  if (
    d.request !== pinRequest ||
    !mapPin ||
    mapPin.kind !== 'coordinate' ||
    mapPin.x !== d.x ||
    mapPin.z !== d.z
  )
    return;
  const point = { ...mapPin, y: d.result.height, biome: d.result.biome };
  mapPin = point;
  if (selectedPoint?.kind === 'coordinate') openPoint(point);
  schedule();
}
function drawMapPin() {
  if (!mapPin) return;
  const x = (mapPin.x - cx) * zoom + w / 2,
    y = (mapPin.z - cz) * zoom + h / 2;
  if (x < -20 || x > w + 20 || y < -20 || y > h + 40) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#10212f';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#7de4c7';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, -19);
  ctx.arc(0, -23, 11, Math.PI, 0);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#10212f';
  ctx.beginPath();
  ctx.arc(0, -23, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
$('place-pin').onclick = () => placeMapPin(world(w / 2, h / 2).x, world(w / 2, h / 2).z);
$('pin-mode').onclick = () => {
  pinPlacement = !pinPlacement;
  $('pin-mode').setAttribute('aria-pressed', String(pinPlacement));
  canvas.classList.toggle('placing-pin', pinPlacement);
};
canvas.onMapTap = (e) => {
  const box = canvas.getBoundingClientRect(),
    x = e.clientX - box.left,
    z = e.clientY - box.top;
  if (mapPin && !pinPlacement) {
    const mx = (mapPin.x - cx) * zoom + w / 2,
      mz = (mapPin.z - cz) * zoom + h / 2 - 21;
    if ((mx - x) ** 2 + (mz - z) ** 2 <= 225) {
      openPoint(mapPin);
      return;
    }
  }
  let hit = null,
    distance = 225;
  if (!pinPlacement)
    for (const target of poiHitTargets) {
      const d = (target.x - x) ** 2 + (target.z - z) ** 2;
      if (d <= distance) {
        distance = d;
        hit = target;
      }
    }
  if (hit) openPoint(hit.p);
  else {
    const p = world(x, z);
    placeMapPin(p.x, p.z);
  }
};
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const p = world(w / 2, h / 2);
    placeMapPin(p.x, p.z);
    $('close-point').focus();
  }
});
const cursorless = matchMedia('(hover: none) and (pointer: coarse)');
let touchInspection = cursorless.matches;
function setTouchInspection(touch) {
  touchInspection = touch || cursorless.matches;
  document.body.classList.toggle('touch-inspection', touchInspection);
  $('inspect-label').textContent = touchInspection ? 'CENTRO DEL MAPA' : 'BAJO EL CURSOR';
  if (touchInspection) queueCenterProbe();
}
function queueCenterProbe() {
  if (!touchInspection) return;
  clearTimeout(centerTimer);
  clearTimeout(hoverTimer);
  hover++;
  const p = world(w / 2, h / 2),
    request = hover;
  $('position').textContent = `X: ${p.x.toLocaleString('es')} · Z: ${p.z.toLocaleString('es')}`;
  if ($('stratum').value === 'underground') {
    const depth = Number($('depth').value);
    let best = null;
    for (const t of tiles.values())
      if (
        t.strataOffsets &&
        p.x >= t.x &&
        p.z >= t.z &&
        p.x < t.x + t.n * t.step &&
        p.z < t.z + t.n * t.step &&
        (!best || t.step < best.step)
      )
        best = t;
    const index = best
      ? Math.floor((p.z - best.z) / best.step) * best.n + Math.floor((p.x - best.x) / best.step)
      : null;
    const env = best
      ? strataCatalog[V1Strata.at(best.strataOffsets, best.strataValues, index, depth)]
      : null;
    $('biome').textContent = env
      ? pretty(env.name.replace(/^Env_/, '').replace(/^Zone\d_/, ''))
      : 'Cargando zona subterránea…';
    $('position').textContent += ` · Y: ${depth}`;
    return;
  }
  centerTimer = setTimeout(() => {
    if (initialized) worker.postMessage({ type: 'point', generation: epoch, request, ...p });
  }, 150);
}
const previousStratumChange = $('stratum').onchange;
$('stratum').onchange = (e) => {
  previousStratumChange(e);
  queueCenterProbe();
};
cursorless.addEventListener('change', () => setTouchInspection(cursorless.matches));
setTouchInspection(cursorless.matches);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePoint();
    $('coords-popover').hidden = true;
    if (mobileLayout.matches) setSidebar(false);
  }
});
if (poiCatalogReady) populateOreGuide();
