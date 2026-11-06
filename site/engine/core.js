'use strict';
/** Independent numerical V1 adapter. Every unsupported operation fails explicitly. */
const V1Noise = typeof module !== 'undefined' ? require('./noise2d.js') : globalThis.SeedNoise;
class V1Kernel {
    constructor(raw, hash) {
        this.raw = raw; this.hash = hash; this.cache = new Array(raw.nodes.length); this.seed = 0; this.unique = []; this.biomeCache = new Map();
        const decode = v => { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(decode); if ('$ref' in v) { const i = v.$ref; if (this.cache[i]) return this.cache[i]; const o = { _id: i }; this.cache[i] = o; for (const [k, x] of Object.entries(raw.nodes[i])) o[k] = decode(x); return o; } if ('$long' in v) return BigInt(v.$long); if ('$enum' in v) return v.value; if ('$biome' in v) return { $biome: v.$biome }; if ('$zone' in v) return { $zone: v.$zone }; if ('$map' in v) return new Map(v.$map.map(([k, x]) => [decode(k), decode(x)])); if ('$weighted' in v) return { weighted: v.$weighted.map(([k, x]) => [decode(k), x]) }; if ('$bits' in v) return new Set(v.$bits); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)])); };
        this.data = decode(Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'nodes')));
        this.biomes = new Map(this.data.biomes.map(b => [b.id, b])); this.zones = new Map(this.data.zones.map(z => [z.name, z]));
        this.climate = this.data.climate; this.graph = this.climate.graph;
    }
    weighted(w, r) { const entries = w.weighted; if (entries.length === 1) return entries[0][0]; let value = Math.min(r, .99999) * entries.reduce((s, e) => s + e[1], 0); for (const [k, weight] of entries) { value -= weight; if (value <= 9.99999999995449e-6) return k; } throw Error('Invalid weighted lookup'); }
    formula(type, n) { const i = Number(type.split('$').at(-1)); switch (i) { case 1: return n; case 2: return 1 - n; case 3: return n * n; case 4: return 1 - n * n; case 5: return Math.sqrt(n); case 6: return 1 - Math.sqrt(n); case 7: return Math.abs(n - .5); case 8: return 1 - Math.abs(n - .5); case 9: return Math.sqrt(Math.abs(n - .5)); case 10: return 1 - Math.sqrt(Math.abs(n - .5)); case 11: return Math.abs(n * 2 - 1); case 12: return 1 - Math.abs(n * 2 - 1); case 13: return Math.sqrt(Math.abs(n * 2 - 1)); case 14: return 1 - Math.sqrt(Math.abs(n * 2 - 1)); case 15: return Math.abs(n * 2 - 1) ** 2; case 16: return 1 - Math.abs(n * 2 - 1) ** 2; default: throw Error('Unsupported formula ' + type); } }
    noise(node, seed, x, y) {
        const N = V1Noise, limit = N.limit;
        switch (node.type) {
            case 'ScaleNoiseProperty': return this.noise(node.noiseProperty, seed, x * node.scaleX, y * node.scaleY);
            case 'OffsetNoiseProperty': return this.noise(node.noiseProperty, seed, x + node.offsetX, y + node.offsetY);
            case 'RotateNoiseProperty': { const m = node.rotation.matrix; return this.noise(node.noise, seed, x * m[0] + y * m[2], x * m[6] + y * m[8]); }
            case 'DistortedNoiseProperty': { const p = this.randomize(node.randomizer, seed, x, y); return this.noise(node.noiseProperty, seed, p.x, p.y); }
            case 'SingleNoiseProperty': return limit(this.function(node.function, seed, (seed + node.seedOffset) | 0, x, y) * .5 + .5);
            case 'FractalNoiseProperty': {
                const mode = Number(node.fractalFunction.type.split('$').at(-1)); let offset = (seed + node.seedOffset) | 0, amp = 1, sum = 0;
                if (mode === 4) { let total = 0, freq = 1; for (let i = 0; i < node.octaves; i++) { sum += this.function(node.function, (seed - 1) | 0, offset, x * freq, y * freq) * amp; offset = (offset + 1) | 0; total += amp; amp *= node.persistence; freq <<= 1; } return (sum / total) * .5 + .5; }
                if (mode === 1) { sum = this.function(node.function, seed, offset, x, y); for (let i = 1; i < node.octaves; i++) { offset = (offset + 1) | 0; x *= node.lacunarity; y *= node.lacunarity; amp *= node.persistence; sum += this.function(node.function, seed, offset, x, y) * amp; } return limit(sum * .5 + .5); }
                if (mode === 5) { sum = this.function(node.function, seed, offset, x, y); for (let i = 1; i < node.octaves; i++) { offset = (offset + 1) | 0; x *= node.lacunarity; y *= node.lacunarity; sum = Math.min(sum, this.function(node.function, seed, offset, x, y)); } return limit(sum * .5 + .5); }
                throw Error('Unsupported fractal ' + mode);
            }
            case 'NoiseFormulaProperty': return this.formula(node.formula.type, this.noise(node.property, seed, x, y));
            case 'NormalizeNoiseProperty': return limit((this.noise(node.noiseProperty, seed, x, y) - node.min) / node.range);
            case 'SumNoiseProperty': { let v = 0; for (const e of node.entries) v += this.noise(e.noiseProperty, seed, x, y) * e.factor; return limit(v); }
            case 'MultiplyNoiseProperty': { let v = this.noise(node.noiseProperties[0], seed, x, y); for (let i = 1; i < node.noiseProperties.length; i++)v *= this.noise(node.noiseProperties[i], seed, x, y); return v; }
            case 'MinNoiseProperty': { let v = this.noise(node.noiseProperties[0], seed, x, y); for (let i = 1; i < node.noiseProperties.length; i++) { if (v < 1e-5) return 0; v = Math.min(v, this.noise(node.noiseProperties[i], seed, x, y)); } return v; }
            case 'MaxNoiseProperty': { let v = this.noise(node.noiseProperties[0], seed, x, y); for (let i = 1; i < node.noiseProperties.length; i++) { if (v > .999999) return 1; v = Math.max(v, this.noise(node.noiseProperties[i], seed, x, y)); } return v; }
            case 'CurveNoiseProperty': { const n = 1 - this.noise(node.noise, seed, x, y); return 1 - Math.pow(n, node.function.a + node.function.b * n); }
            case 'BlendNoiseProperty': { const a = this.noise(node.alpha, seed, x, y), t = node.thresholds, p = node.noises; if (!p.length) return 0; if (a <= t[0]) return this.noise(p[0], seed, x, y); if (a >= t.at(-1)) return this.noise(p.at(-1), seed, x, y); for (let i = 1; i < p.length; i++)if (a <= t[i]) { const lo = this.noise(p[i - 1], seed, x, y), hi = this.noise(p[i], seed, x, y); return lo + (hi - lo) * (a - t[i - 1]) * node.normalize[i]; } return 0; }
            default: throw Error('Unsupported noise property ' + node.type);
        }
    }
    function(node, seed, offset, x, y) {
        const N = V1Noise;
        switch (node.type) {
            case 'OldSimplexNoise': return N.oldSimplex(seed, offset, x, y);
            case 'SimplexNoise': return N.simplex(seed, offset, x, y);
            case 'ConstantNoise': return node.value;
            case 'PointNoise': { const dx = x - node.x, dy = y - node.y, d = dx * dx + dy * dy; if (d <= node.innerRadius2) return -1; if (d >= node.outerRadius2) return 1; return -1 + 2 * (d - node.innerRadius2) * node.invRange2; }
            case 'GridNoise': { x -= Math.floor(x); y -= Math.floor(y); let d = 1; if (x < node.thicknessX) d = x / node.thicknessX; else if (x > node.thicknessX_m1) d = (1 - x) / node.thicknessX; if (y < node.thicknessY) d = Math.min(d, y / node.thicknessY); else if (y > node.thicknessY_m1) d = Math.min(d, (1 - y) / node.thicknessY); return d * 2 - 1; }
            case 'NoiseAsset$1': { const result = this.nearest(node.distanceFunction, node.pointEvaluator, offset, x, y, false), mode = Number(node.cellFunction.type.split('$').at(-1)); let v; if (mode === 1) v = this.hash.random3(offset, result.ix, result.iy); else if (mode === 2) { const factor = this.gridScale(node.distanceFunction); v = this.noise(node.noiseLookup, seed, result.x / factor, result.y / factor); } else if (mode === 3) v = Math.sqrt(result.distance); else throw Error('Unsupported cell mode ' + mode); return N.limit(v) * 2 - 1; }
            case 'NoiseAsset$2': { const b = this.nearest(node.cellDistanceFunction, node.pointEvaluator, offset, x, y, true), a = Math.sqrt(b.distance), c = Math.sqrt(b.distance2), m = Number(node.distance2Function.type.split('$').at(-1)); const v = m === 1 ? a + c : m === 2 ? c - a : m === 3 ? a * c : m === 4 ? a / c : m === 5 ? a : m === 6 ? c : NaN; return N.limit(v) * 2 - 1; }
            default: throw Error('Unsupported noise function ' + node.type);
        }
    }
    randomize(r, seed, x, y) {
        if (!r) return { x, y }; if (r.type === 'CoordinateRotator') { const m = r.matrix; return { x: x * m[0] + y * m[2], y: x * m[6] + y * m[8] }; }
        let dx = 0, dy = 0; for (const p of r.xNoise || []) dx += (this.noise(p.property, seed, x, y) * 2 - 1) * p.amplitude; for (const p of r.yNoise || []) dy += (this.noise(p.property, seed, x, y) * 2 - 1) * p.amplitude; return { x: x + dx, y: y + dy };
    }
    threshold(t, value, factor = 0) { if (t.type === 'DoubleThresholdCondition') return this.threshold(t.threshold, value, factor); if (t.type === 'DoubleThreshold$Single') return t.min + t.halfRange * factor <= value && value <= t.max - t.halfRange * factor; if (t.type === 'DoubleThreshold$Multiple') return t.singles.some(s => this.threshold(s, value, factor)); throw Error('Unsupported threshold ' + t.type); }
    density(t, hash) { if (!t) return true; if (t.type === 'DensityPointEvaluator$$Lambda') return !t.arg$1 || this.threshold(t.arg$1, this.hash.random2(hash, -1694747730)); throw Error('Unsupported density ' + t.type); }
    jitter(e) { if (e.jitter) return e.jitter; return e.pointEvaluator ? this.jitter(e.pointEvaluator) : { jitterX: 1, jitterY: 1 }; }
    metric(node, dx, dy) { const m = node?.type; if (!m || m === 'DistanceCalculationMode$1') return dx * dx + dy * dy; if (m === 'DistanceCalculationMode$2') return Math.abs(dx) + Math.abs(dy); if (m === 'DistanceCalculationMode$3') return Math.abs(dx) + Math.abs(dy) + dx * dx + dy * dy; if (m === 'DistanceCalculationMode$4') return Math.max(Math.abs(dx), Math.abs(dy)); throw Error('Unsupported distance ' + m); }
    evaluate(e, seed, qx, qy, hash, cx, cy, px, py, b, two) {
        if (e.type === 'JitterPointEvaluator') return this.evaluate(e.pointEvaluator, seed, qx, qy, hash, cx, cy, px, py, b, two);
        if (e.type === 'DensityPointEvaluator') { if (!this.density(e.density, hash)) return; return this.evaluate(e.pointEvaluator, seed, qx, qy, hash, cx, cy, px, py, b, two); }
        let distance;
        if (e.type === 'BorderPointEvaluator') {
            if (cx === b.ix2 && cy === b.iy2) return; const ax = (px + b.x2) * .5, ay = (py + b.y2) * .5, nx = -(py - b.y2), ny = px - b.x2;
            const dx = qx - ax, dy = qy - ay, norm = nx * nx + ny * ny; distance = norm === 0 ? dx * dx + dy * dy : ((ny * dx - nx * dy) ** 2) / norm;
            if (distance < b.distance) { if (two) b.distance2 = b.distance; b.distance = distance; } else if (two && distance < b.distance2) b.distance2 = distance; return;
        }
        distance = this.metric(e.distanceFunction, px - qx, py - qy);
        if (e.type === 'DistancePointEvaluator') { const r = e.distanceMod.arg$1; if (r) { const random = this.hash.random2(hash, 1495661265); distance *= r.type === 'DoubleRange$Constant' ? r.result : r.min + r.range * random; } }
        else if (e.type !== 'NormalPointEvaluator') throw Error('Unsupported point evaluator ' + e.type);
        if (distance < b.distance) { if (two) { b.distance2 = b.distance; b.x2 = b.x; b.y2 = b.y; b.ix2 = b.ix; b.iy2 = b.iy; } Object.assign(b, { hash, ix: cx, iy: cy, distance, x: px, y: py }); }
        else if (two && distance < b.distance2) Object.assign(b, { distance2: distance, x2: px, y2: py, ix2: cx, iy2: cy });
    }
    gridScale(g) { return g.type === 'BorderDistanceFunction' ? this.gridScale(g.distanceFunction) : g.type === 'HexCellDistanceFunction' ? (Math.sqrt(3) + 1.5) / 2 : 1; }
    cellHash(grid, seed, x, y) { if (grid.type !== 'HexCellDistanceFunction') return this.hash.rehash3(seed, x, y); let h = (x + Math.imul(y, 198491317)) | 0; h = (Math.imul(h, -1255572915) + seed) | 0; h ^= h >> 8; h = (h - 1255572915) | 0; h ^= h << 8; h = Math.imul(h, -1255572915); return h ^ (h >> 8); }
    evalCell(grid, e, seed, x, y, cx, cy, b, two) { const hash = this.cellHash(grid, seed, cx, cy), v = V1Noise.CELL2[hash & 255], j = this.jitter(e), hex = grid.type === 'HexCellDistanceFunction'; let px = cx + (v[0] - (hex ? .5 : 0)) * j.jitterX, py = cy + (v[1] - (hex ? .5 : 0)) * j.jitterY; if (hex) { const a = px; px = Math.sqrt(3) * a + Math.sqrt(3) / 2 * py; py = 1.5 * py; } this.evaluate(e, seed, x, y, hash, cx, cy, px, py, b, two); }
    gridNearest(grid, e, seed, x, y, b, two) {
        if (grid.type === 'BorderDistanceFunction') {
            this.gridNearest(grid.distanceFunction, grid.cellEvaluator, seed, x, y, b, false);
            if (!this.density(grid.density, b.hash)) { b.distance = 0; return; }
            const cx = b.ix, cy = b.iy; b.ix2 = cx; b.iy2 = cy; b.x2 = b.x; b.y2 = b.y; b.distance = Infinity; b.distance2 = Infinity;
            const j = this.jitter(grid.borderEvaluator), dx = j.jitterX > .5 ? 2 : 1, dy = j.jitterY > .5 ? 2 : 1;
            for (let yy = cy - dy; yy <= cy + dy; yy++)for (let xx = cx - dx; xx <= cx + dx; xx++)this.evalCell(grid.distanceFunction, grid.borderEvaluator, seed, x, y, xx, yy, b, true); return;
        }
        if (grid.type === 'DirectGrid') { b.x = x; b.y = y; return; }
        const hex = grid.type === 'HexCellDistanceFunction';
        const cx = hex ? Math.floor(Math.sqrt(3) / 3 * x - y / 3 + .5) : Math.floor(x), cy = hex ? Math.floor(2 / 3 * y + .5) : Math.floor(y);
        let dx = 1, dy = 1; if (hex && two) { const j = this.jitter(e); if (j.jitterX > .5) dx = 2; if (j.jitterY > .5) dy = 2; }
        for (let yy = cy - dy; yy <= cy + dy; yy++)for (let xx = cx - dx; xx <= cx + dx; xx++) { if (hex && Math.abs(xx - cx) === 2 && Math.abs(yy - cy) === 2) continue; this.evalCell(grid, e, seed, x, y, xx, yy, b, two); }
        if (hex) { b.distance /= 3; if (two) b.distance2 /= 3; }
    }
    nearest(grid, e, seed, x, y, two) { const scale = this.gridScale(grid); x *= scale; y *= scale; const b = { distance: Infinity, distance2: Infinity, hash: 0, ix: 0, iy: 0, x: 0, y: 0, ix2: 0, iy2: 0, x2: 0, y2: 0 }; this.gridNearest(grid, e, seed, x, y, b, two); return b; }
    point(p, seed, x, y) { if (p.type === 'DistortedPointGenerator') { const q = this.randomize(p.coordinateRandomizer, seed, x, y); return this.point(p.pointGenerator, seed, q.x, q.y); } if (p.type === 'ScaledPointGenerator') { const b = this.point(p.pointGenerator, seed, x * p.scale, y * p.scale); b.x /= p.scale; b.y /= p.scale; b.distance = Math.sqrt(b.distance) / p.scale; return b; } return this.nearest(p.cellDistanceFunction, p.pointEvaluator, (seed + p.seedOffset) | 0, x, y, false); }
    graphIndex(t, i) { return Math.floor(i * this.graph.height) * this.graph.table.width + Math.floor(t * this.graph.width); }
    climateSample(x, y) {
        const s = this.seed, n = this.climate.noise, g = n.grid; let px = x * g.scale, py = y * g.scale; if (g.grid.type === 'DirectGrid') { px *= g.invScale; py *= g.invScale; } else { const p = this.nearest(g.grid, g.evaluator, (s + g.seedOffset) | 0, px, py, false); px = p.x * g.invScale; py = p.y * g.invScale; }
        const c = this.noise(n.continent, s, x, y), t = this.noise(n.temperature, s, px, py), i = this.noise(n.intensity, s, px, py), index = this.graphIndex(t, i), id = this.graph.table.values[index]; return { c, t, i, fade: this.graph.fade.values[index] * this.graph.fadeDistance, id };
    }
    climateColor(sample) { const th = this.climate.noise.thresholds, c = sample.c, type = this.graph.id2TypeLookup[sample.id]; let flags = 0; const land = c <= th.landShallowOceanOuter, island = c >= th.islandShallowOceanOuter, ocean = c > th.land && c < th.island, shore = land && c > th.landShoreInner || island && c < th.islandShoreInner; if (ocean) flags |= 0x80000000; if (shore) flags |= 0x40000000; if (island) flags |= 0x20000000; switch (flags | 0) { case -2147483648: return type.color.ocean; case 1073741824: return type.color.shore; case -1073741824: return type.color.shallowOcean; case 536870912: return type.island.land; case 1610612736: return type.island.shore; case -536870912: return type.island.shallowOcean; default: return type.color.land; } }
    setSeed(value) { this.seed = Number(BigInt.asIntN(32, BigInt(value))); this.unique = []; this.biomeCache.clear(); const entries = this.climate.uniqueGenerator.entries; for (let pass = 0; pass < 10 && this.unique.length < entries.length; pass++)for (const entry of entries) { if (this.unique.some(u => u.zone === entry.zone)) continue; const parent = entry.parent ? this.unique.find(u => u.zone === entry.parent) : null; if (entry.parent && !parent) continue; const pos = this.searchUnique(entry, (parent?.x || 0) + entry.origin.x, (parent?.y || 0) + entry.origin.y); this.unique.push({ ...pos, zone: entry.zone, radius: entry.radius, color: entry.color }); } return this.unique; }
    searchUnique(entry, cx, cy) {
        const mask = (1n << 48n) - 1n, mul = 25214903917n; let rng = (this.hash.searchSeed(this.seed) ^ mul) & mask; const next = bits => { rng = (rng * mul + 11n) & mask; return Number(rng >> BigInt(48 - bits)); }; const random = () => (next(26) * 134217728 + next(27)) / 9007199254740992; let best = 0, bx = cx, by = cy; const n = this.climate.noise, rule = entry.rule;
        const score = (x, y) => { const c = this.noise(n.continent, this.seed, x, y); if (Math.abs(c - rule.continent.value) > rule.continent.radius) return 0; const t = this.noise(n.temperature, this.seed, x, y); if (Math.abs(t - rule.temperature.value) > rule.temperature.radius) return 0; const i = this.noise(n.intensity, this.seed, x, y); if (Math.abs(i - rule.intensity.value) > rule.intensity.radius) return 0; const f = this.graph.fade.values[this.graphIndex(t, i)]; if (Math.abs(f - rule.fade.value) > rule.fade.radius) return 0; let sum = 0; for (const [r, v] of [[rule.continent, c], [rule.temperature, t], [rule.intensity, i], [rule.fade, f]]) sum += (1 - Math.min(r.radius, Math.abs(v - r.value)) / r.radius) * r.weight; return sum / rule.sumWeight; };
        for (let r = entry.minDistance; r <= Math.min(entry.maxDistance, 10000); r += 100) { const steps = Math.floor(Math.PI * 2 * r / 100), inc = Math.PI * 2 / steps, off = Math.PI * 2 * random(); for (let k = 0; k < steps; k++) { const a = k * inc + off, x = cx + Math.trunc(Math.cos(a) * r), y = cy + Math.trunc(Math.sin(a) * r), v = score(x, y); if (v > best) { best = v; bx = x; by = y; } } if (best >= .75) break; } return { x: bx, y: by, score: best };
    }
    zoneAt(x, y) {
        const s = this.seed, q = this.randomize(this.climate.randomizer, s, x, y); let color, fade = 0; const unique = this.unique.find(u => Math.floor(q.x) - u.x >= -u.radius && Math.floor(q.x) - u.x <= u.radius && Math.floor(q.y) - u.y >= -u.radius && Math.floor(q.y) - u.y <= u.radius && (Math.floor(q.x) - u.x) ** 2 + (Math.floor(q.y) - u.y) ** 2 <= u.radius * u.radius);
        if (unique) color = unique.color; else { const c = this.climateSample(q.x, q.y); color = this.climateColor(c); fade = c.fade; }
        const possible = this.data.zoneMapping.mapping.get(color & 0xffffff); if (!possible) throw Error('Unmapped climate color ' + color);
        if (possible.length === 1) return { zone: this.zones.get(possible[0].$zone), fade };
        const p = this.point(this.data.zonePoints, s, x, y), index = (this.hash.hash3(s, p.ix, p.iy) & 0x7fffffff) % possible.length; return { zone: this.zones.get(possible[index].$zone), fade: p.distance };
    }
    at(x, y) {
        const zoneResult = this.zoneAt(x, y), zone = zoneResult.zone, p = this.point(zone.points, this.seed, x, y), tile = this.weighted(zone.tiles, this.hash.random3(this.seed, p.ix, p.iy)); let biome = this.biomes.get(tile.$biome);
        for (const ref of zone.custom) { const custom = this.biomes.get(ref.$biome), g = custom.custom; if (!g.biomeMask.set.includes(biome.id)) continue; const noise = this.noise(g.noiseProperty, this.seed, x, y), fade = custom.fade; let factor = 0; if (zoneResult.fade < fade.maskFadeSum) { factor = 1 - V1Noise.limit((zoneResult.fade - fade.maskFadeStart) / fade.maskFadeLength); if (factor < 1e-5) continue; } if (this.threshold(g.threshold, noise, factor)) { biome = custom; break; } }
        return { zone: zone.name, zoneId: zone.id, biome: biome.name, biomeId: biome.id, color: biome.color, border: zoneResult.fade };
    }
}
globalThis.V1Kernel = V1Kernel; if (typeof module !== 'undefined') module.exports = V1Kernel;
