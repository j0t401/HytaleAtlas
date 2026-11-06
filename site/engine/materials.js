'use strict';
/** Pre-cave V1 terrain/layer calculations. Not a final generated-world resource map. */
function installV1Materials(Kernel) {
  const P = Kernel.prototype,
    noise = P.noise,
    threshold = P.threshold;
  P.noise = function (node, seed, x, z) {
    if (node.type === 'InvertNoiseProperty') return 1 - this.noise(node.noiseProperty, seed, x, z);
    if (node.type === 'GradientNoiseProperty') {
      if (node.mode !== 'MAGNITUDE') throw Error('Unsupported gradient mode ' + node.mode);
      const v = this.noise(node.noise, seed, x, z),
        s = this.noise(node.noise, seed, x, z + node.distance),
        e = this.noise(node.noise, seed, x + node.distance, z);
      return Math.max(
        0,
        Math.min(1, Math.sqrt((e - v) * (e - v) + (s - v) * (s - v)) * node.invNormalize),
      );
    }
    if (node.type === 'FractalNoiseProperty' && node.fractalFunction.type.endsWith('$6')) {
      let offset = (seed + node.seedOffset) | 0,
        sum = this.function(node.function, seed, offset, x, z);
      for (let i = 1; i < node.octaves; i++) {
        offset = (offset + 1) | 0;
        x *= node.lacunarity;
        z *= node.lacunarity;
        sum = Math.max(sum, this.function(node.function, seed, offset, x, z));
      }
      return Math.max(0, Math.min(1, sum * 0.5 + 0.5));
    }
    return noise.call(this, node, seed, x, z);
  };
  P.threshold = function (node, value, factor = 0) {
    if (node.type === 'SingleDoubleCondition') return value < node.value;
    return threshold.call(this, node, value, factor);
  };
  P.range = function (node, value) {
    if (node.type === 'DoubleRange$Constant') return node.result;
    if (node.type === 'DoubleRange$Normal') return node.min + node.range * value;
    if (node.type === 'DoubleRange$Multiple') {
      const t = node.thresholds,
        v = node.values;
      if (value > t.at(-1)) return v.at(-1);
      let lo = 0;
      for (let i = 0; i < t.length; i++) {
        if (value < t[i])
          return i === 0 ? v[0] : v[i - 1] + ((value - lo) / (t[i] - lo)) * (v[i] - v[i - 1]);
        lo = t[i];
      }
      return 0;
    }
    throw Error('Unsupported range ' + node.type);
  };
  P.supplier = function (node, x, z) {
    switch (node.type) {
      case 'ConstantCoordinateDoubleSupplier':
      case 'ConstantDoubleCoordinateSupplier':
        return node.value ?? node.result;
      case 'DoubleRangeNoiseSupplier':
        return node.range.type === 'DoubleRange$Constant'
          ? node.range.result
          : this.range(node.range, this.noise(node.noiseProperty, this.seed, x, z));
      case 'RandomCoordinateDoubleSupplier':
        return this.range(node.range, this.hash.random3(this.seed, x, z));
      default:
        throw Error('Unsupported coordinate supplier ' + node.type);
    }
  };
  P.repetitions = function (entry, x, z) {
    return Math.floor(
      entry.repetitions.type === 'DoubleRange$Constant'
        ? entry.repetitions.result
        : this.range(entry.repetitions, this.noise(entry.noise, this.seed, x, z)),
    );
  };
  P.activeLayer = function (layer, x, z) {
    if (!this.condition(layer.mapCondition, x, z)) return null;
    return layer.entries.find((e) => this.condition(e.mapCondition, x, z)) || null;
  };
  P.topBlock = function (biome, x, z) {
    for (const layer of biome.layers.dynamicLayers) {
      const entry = this.activeLayer(layer, x, z);
      if (!entry) continue;
      for (const b of entry.blockArray.entries)
        if (this.repetitions(b, x, z) > 0) return b.blockEntry;
      return { blockId: 0, fluidId: 0 };
    }
    return biome.layers.filling;
  };
  P.baseMaterialColumn = function (x, z) {
    const terrain = this.terrainColumn(x, z),
      layers = terrain.center.biomeDefinition.layers;
    if (!layers) throw Error('Layer configuration not loaded');
    const blocks = new Int32Array(320),
      fluids = new Int32Array(320),
      environments = new Int32Array(320),
      priorities = new Uint8Array(320),
      rotations = new Uint8Array(320),
      surfaces = [];
    let priority = 1;
    environments.fill(this.environmentAt(x, z));
    const set = (y, block, env) => {
      if (y < 0 || y >= 320) return;
      blocks[y] = block.blockId;
      rotations[y] = block.rotation || 0;
      priorities[y] = priority;
      fluids[y] = priority === 1 ? 0 : block.fluidId;
      if (env !== undefined && env !== -2147483648) environments[y] = env;
    };
    let empty = true,
      y;
    for (y = terrain.highest; y >= terrain.lowest; y--) {
      const t = terrain.threshold(y);
      if (t > terrain.noise || t === 1) {
        set(y, layers.filling, layers.fillingEnvironment);
        if (empty) {
          surfaces.push(y);
          empty = false;
        }
      } else empty = true;
    }
    if (empty) surfaces.push(y);
    for (; y >= 0; y--) set(y, layers.filling);
    const staticLayers = () => {
      for (const layer of layers.staticLayers) {
        const entry = this.activeLayer(layer, x, z);
        if (!entry) continue;
        const entries = entry.blockArray.entries,
          min = Math.max(Math.floor(this.supplier(entry.min, x, z)), 0),
          max = Math.min(Math.floor(this.supplier(entry.max, x, z)), 320);
        let layerY = Math.floor(this.supplier(entry.max, x, z)),
          last = null;
        for (const item of entries) {
          const repetitions = this.repetitions(item, x, z);
          if (repetitions <= 0) continue;
          last = item.blockEntry;
          for (let i = 0; i < repetitions; i++) {
            layerY--;
            if (layerY >= 0 && layerY < 320 && blocks[layerY] !== 0)
              set(layerY, last, layer.environmentId);
            if (layerY <= min) return;
          }
        }
        if (!entries.length && layer.environmentId !== -2147483648)
          for (let y = max - 1; y >= min; y--) if (y < 320) environments[y] = layer.environmentId;
        if (last)
          while (layerY > min) {
            layerY--;
            if (layerY >= 0 && layerY < 320 && blocks[layerY] !== 0) set(layerY, last);
          }
      }
    };
    priority = 2;
    staticLayers();
    for (let i = 0; i < surfaces.length; i++) {
      const surface = surfaces[i];
      let y = surface,
        maxY = surface;
      dynamic: for (const layer of layers.dynamicLayers) {
        const entry = this.activeLayer(layer, x, z);
        if (!entry) continue;
        y += Math.floor(this.supplier(layer.offset, x, z));
        maxY = Math.max(maxY, y);
        for (const item of entry.blockArray.entries) {
          const repetitions = this.repetitions(item, x, z);
          for (let n = 0; n < repetitions; n++) {
            if (y <= surface && (y < 0 || blocks[y] === 0)) break dynamic;
            set(y, item.blockEntry, layer.environmentId);
            y--;
          }
        }
      }
      if (maxY > surface) surfaces[i] = maxY;
    }
    return {
      blocks,
      fluids,
      environments,
      priorities,
      rotations,
      surfaces,
      height: terrain.height,
      meaning: 'Terrain and layers before cover, caves, prefabs and water passes',
    };
  };
}
if (typeof module !== 'undefined') module.exports = installV1Materials;
else installV1Materials(globalThis.V1Kernel);
