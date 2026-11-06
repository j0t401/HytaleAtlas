'use strict';
/** Verified arithmetic layer for Default V1 terrain. Does not place caves/prefabs. */
function installV1Terrain(Kernel) {
  const P = Kernel.prototype,
    F = Math.fround;
  P.condition = function (c, x, z) {
    switch (c.type) {
      case 'DefaultCoordinateCondition':
        return c.result;
      case 'NoiseMaskCondition':
        return this.threshold(c.condition, this.noise(c.noiseMask, this.seed, x, z));
      default:
        throw Error('Unsupported coordinate condition ' + c.type);
    }
  };
  P.heightContext = function (interpreter, x, z) {
    if (interpreter.type === 'BasicHeightThresholdInterpreter') return 0;
    if (interpreter.type === 'NoiseHeightThresholdInterpreter')
      return this.noise(interpreter.noise, this.seed, x, z);
    throw Error('Unsupported height interpreter ' + interpreter.type);
  };
  P.heightThreshold = function (node, x, z, y, context) {
    if (y > node.highestNonZero) return 0;
    if (node.type === 'BasicHeightThresholdInterpreter')
      return node.interpolatedThresholds[
        Math.max(0, Math.min(y, node.interpolatedThresholds.length - 1))
      ];
    if (node.type === 'NoiseHeightThresholdInterpreter') {
      if (context === undefined) context = this.heightContext(node, x, z);
      const keys = node.keys,
        values = node.values;
      for (let i = 0; i < keys.length; i++)
        if (context <= keys[i]) {
          if (!i) return this.heightThreshold(values[0], x, z, y);
          const t = F(F(F(context) - keys[i - 1]) / F(keys[i] - keys[i - 1])),
            a = this.heightThreshold(values[i - 1], x, z, y),
            b = this.heightThreshold(values[i], x, z, y);
          return F(a + F(F(b - a) * t));
        }
      return this.heightThreshold(values.at(-1), x, z, y);
    }
    throw Error('Unsupported height threshold ' + node.type);
  };
  P.terrainPoint = function (x, z) {
    const key = x + ',' + z;
    this.terrainCache ??= new Map();
    if (this.terrainCache.has(key)) return this.terrainCache.get(key);
    const result = this.at(x, z),
      biome = this.biomes.get(result.biomeId),
      context = this.heightContext(biome.heightInterpreter, x, z);
    let noise = this.noise(biome.heightNoise, this.seed, x, z);
    const fade = biome.fade;
    if (typeof fade.fadeHeightmap === 'number' && Number.isFinite(fade.fadeHeightmap)) {
      const factor =
        1 -
        Math.max(0, Math.min(1, (result.border - fade.terrainFadeStart) / fade.terrainFadeLength));
      noise = noise * (1 - factor) + fade.fadeHeightmap * factor;
    }
    const entry = { ...result, biomeDefinition: biome, context, noise };
    this.terrainCache.set(key, entry);
    if (this.terrainCache.size > 16000)
      this.terrainCache.delete(this.terrainCache.keys().next().value);
    return entry;
  };
  P.terrainColumn = function (x, z) {
    const center = this.terrainPoint(x, z),
      definition = center.biomeDefinition,
      counts = [{ biome: definition, context: center.context, noise: center.noise, count: 1 }],
      radius = definition.interpolation.radius,
      r2 = radius * radius,
      radii = definition.interpolation.biomeRadii2;
    for (let ix = -radius; ix <= radius; ix++)
      for (let iz = -radius; iz <= radius; iz++) {
        const d2 = ix * ix + iz * iz;
        if ((ix === 0 && iz === 0) || d2 > r2) continue;
        const p = this.terrainPoint((x + ix) | 0, (z + iz) | 0),
          b = p.biomeDefinition;
        if (d2 > (radii.get(b.id) ?? 25)) continue;
        let entry = counts.find((v) => v.biome.id === b.id);
        if (!entry) counts.push({ biome: b, context: p.context, noise: p.noise, count: 1 });
        else {
          entry.noise = entry.noise - entry.noise / entry.count + p.noise / entry.count;
          entry.count++;
        }
      }
    if (counts.length === 1) {
      counts[0].noise = center.noise;
      counts[0].count = 1;
    }
    let noise = 0,
      count = 0,
      highest = -1,
      lowest = 320;
    for (const entry of counts) {
      noise += entry.noise * entry.count;
      count += entry.count;
      highest = Math.max(highest, entry.biome.heightInterpreter.highestNonZero);
      lowest = Math.min(lowest, entry.biome.heightInterpreter.lowestNonOne);
    }
    noise /= count;
    const threshold = (y) => {
      let sum = F(0),
        n = 0;
      for (const entry of counts) {
        sum = F(
          sum +
            F(
              this.heightThreshold(entry.biome.heightInterpreter, x, z, y, entry.context) *
                F(entry.count),
            ),
        );
        n += entry.count;
      }
      return F(sum / F(n));
    };
    let height = 0;
    for (let y = highest; y > 0; y--) {
      const t = threshold(y);
      if (t > noise || t === 1) {
        height = y;
        break;
      }
    }
    return { height, noise, lowest, highest, threshold, center, counts };
  };
  P.environmentAt = function (x, z) {
    const b = this.biomes.get(this.at(x, z).biomeId),
      env = b.environments,
      e = env.entries.find((e) => this.condition(e.mapCondition, x, z)) || env.defaultEntry;
    return this.weighted(e.environmentMapping, this.noise(e.valueNoise, this.seed, x, z));
  };
  P.uniqueStructures = function () {
    const results = [];
    for (const unique of this.unique) {
      const zone = this.zones.get(unique.zone),
        container = zone.uniquePrefabs;
      if (!container) continue;
      for (const generator of container.generators) {
        let x = unique.x,
          z = unique.y;
        for (let i = 0; i < 8; i++) {
          const p = this.randomize(this.climate.randomizer, this.seed, x, z);
          x -= Math.trunc((Math.floor(p.x) - unique.x) / 2);
          z -= Math.trunc((Math.floor(p.y) - unique.y) / 2);
        }
        const config = generator.configuration,
          b = this.biomes.get(this.at(x, z).biomeId);
        let y;
        if (config.onWater && b.water?.entries.length) {
          y = -2147483648;
          for (const e of b.water.entries) {
            const lo = Math.floor(this.supplier(e.min, x, z)),
              hi = Math.floor(this.supplier(e.max, x, z));
            if (lo <= hi && hi > y) y = hi;
          }
          if (y < 0) y = -2147483648;
        } else y = this.terrainColumn(x, z).height;
        if (generator.prefabs.weighted.length !== 1 || config.rotations?.length !== 1)
          throw Error('Unsupported unique prefab selection ' + generator.name);
        results.push({
          name: generator.name,
          x,
          y,
          z,
          spawn: config.spawnLocation,
          prefabPath: generator.prefabs.weighted[0][0].path,
          rotation: config.rotations[0],
          category: generator.category.name || generator.name,
          meaning: 'Unique prefab anchor; not the player spawn offset.',
        });
      }
    }
    // Default currently has exactly these two unique generators. Fail instead of silently skipping future ones.
    for (const zone of this.data.zones)
      if (zone.uniquePrefabs?.generators.length && !this.unique.some((u) => u.zone === zone.name))
        throw Error('Unsupported non-unique-zone structure generator ' + zone.name);
    return results;
  };
  P.supplier = function (node, x, z) {
    switch (node.type) {
      case 'ConstantDoubleCoordinateSupplier':
        return node.value ?? node.result;
      case 'DoubleRangeNoiseSupplier': {
        const r = node.range;
        return r.type === 'DoubleRange$Constant'
          ? r.result
          : r.min + r.range * this.noise(node.noise, this.seed, x, z);
      }
      default:
        throw Error('Unsupported coordinate supplier ' + node.type);
    }
  };
  const seed = P.setSeed;
  P.setSeed = function (value) {
    this.terrainCache?.clear();
    return seed.call(this, value);
  };
}
if (typeof module !== 'undefined') module.exports = installV1Terrain;
else installV1Terrain(globalThis.V1Kernel);
