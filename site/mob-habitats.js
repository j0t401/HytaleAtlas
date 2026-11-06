'use strict';
/** Eligibility areas from cached environment samples. Never invents living-NPC coordinates. */
class AtlasMobHabitats {
  constructor(at) {
    this.at = at;
    this.cache = new WeakMap();
    this.signature = '';
    this.byEnvironment = new Map();
  }
  select(types) {
    const signature = types
      .map((t) => t.key)
      .sort()
      .join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.byEnvironment = new Map();
    for (const t of types)
      for (const id of t.habitatEnvironments || []) {
        if (!this.byEnvironment.has(id)) this.byEnvironment.set(id, []);
        this.byEnvironment.get(id).push(t);
      }
  }
  sample(tile, depth = null) {
    if (!this.byEnvironment.size || (depth === null && !tile.surfaceEnvironments)) return null;
    if (depth !== null && !tile.strataOffsets) return null;
    const key = this.signature + '/' + (depth === null ? 'surface' : depth);
    let cached = this.cache.get(tile);
    if (!cached) {
      cached = new Map();
      this.cache.set(tile, cached);
    }
    if (cached.has(key)) return cached.get(key);
    const pixels = new Uint8ClampedArray(tile.n * tile.n * 4),
      groups = new Map();
    for (let i = 0; i < tile.n * tile.n; i++) {
      if (tile.pixels && tile.pixels[i * 4 + 3] === 0) continue;
      const id =
        depth === null
          ? tile.surfaceEnvironments[i]
          : this.at(tile.strataOffsets, tile.strataValues, i, depth);
      const types = this.byEnvironment.get(id);
      if (!types) continue;
      pixels.set([125, 228, 199, 48], i * 4);
      const column = i % tile.n,
        row = Math.floor(i / tile.n),
        distance = (column - tile.n / 2) ** 2 + (row - tile.n / 2) ** 2;
      for (const type of types) {
        const gkey = type.key + '/' + id,
          previous = groups.get(gkey);
        if (!previous || distance < previous.distance)
          groups.set(gkey, {
            key: type.key,
            kind: 'mob',
            name: type.name,
            x: tile.x + column * tile.step,
            z: tile.z + row * tile.step,
            y: depth,
            source: 'habitat',
            confirmed: false,
            environmentId: id,
            distance,
            habitatRules: type.habitats.filter((h) => h.environmentIds.includes(id)),
          });
      }
    }
    const result = { pixels, points: [...groups.values()] };
    cached.set(key, result);
    if (cached.size > 2) cached.delete(cached.keys().next().value);
    return result;
  }
}
if (typeof module !== 'undefined') module.exports = AtlasMobHabitats;
let mobHabitatLayer,
  habitatFramePoints = new Map();
function beginHabitatFrame() {
  mobHabitatLayer ??= new AtlasMobHabitats(V1Strata.at);
  const types = [...poiSelected]
    .map((key) => poiTypes.get(key))
    .filter((t) => t?.habitatEnvironments?.length);
  mobHabitatLayer.select(types);
  habitatFramePoints.clear();
  const status = $('mob-habitat-status');
  if (status) {
    if (status.hidden !== !types.length) status.hidden = !types.length;
    const text =
      types.length +
      ' mobs con hábitat seleccionado · sombreado = zona posible; no indica un individuo garantizado.';
    if (status.textContent !== text) status.textContent = text;
  }
}
function paintHabitatTile(tile, x, z, size) {
  if (!mobHabitatLayer) return;
  const depth = $('stratum').value === 'underground' ? Number($('depth').value) : null;
  const data = mobHabitatLayer.sample(tile, depth);
  if (!data || !data.points.length) return;
  if (!data.canvas) {
    data.canvas = document.createElement('canvas');
    data.canvas.width = data.canvas.height = tile.n;
    data.canvas.getContext('2d').putImageData(new ImageData(data.pixels, tile.n, tile.n), 0, 0);
  }
  ctx.drawImage(data.canvas, x, z, size + 0.2, size + 0.2);
  // Keep one guide per species/environment in a screen-sized world bucket.
  const span = Math.max(1, Math.ceil(96 / zoom));
  for (const p of data.points) {
    const key =
      p.key + '/' + p.environmentId + '/' + Math.floor(p.x / span) + '/' + Math.floor(p.z / span);
    const previous = habitatFramePoints.get(key);
    if (!previous || tile.step < previous.step)
      habitatFramePoints.set(key, { ...p, step: tile.step });
  }
}
function drawHabitatMarkers() {
  for (const point of habitatFramePoints.values()) paintPOI(point);
}
