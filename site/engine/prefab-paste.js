'use strict';
/** V1 prefab block placement. Caller supplies validated terrain and spawn conditions. */
class V1PrefabPaste {
  constructor(data, iterator) {
    this.data = data;
    this.iterator = iterator;
    this.I = typeof module !== 'undefined' ? require('./random.js') : globalThis.V1Integer;
  }
  mask(condition, current, fluid, next, nextFluid, direct = false) {
    if (condition.type === 'ConstantBlockMask')
      return direct ? current === 0 || fluid === 0 : condition.result;
    if (condition.type !== 'BlockMaskCondition')
      throw Error('Unsupported prefab block mask ' + condition.type);
    const key = BigInt.asIntN(64, (BigInt(next) << 32n) | BigInt(nextFluid >>> 0)),
      mask = condition.specificMasks.get(key) ?? condition.defaultMask;
    for (const entry of mask.entries)
      if (
        entry.any ||
        entry.blocks.entries.some((e) => e.blockId === current && e.fluidId === fluid)
      )
        return entry.replace;
    return mask.matchEmpty && (current === 0 || fluid === 0);
  }
  choose(child, random) {
    const choices = child.choices;
    if (!choices?.length) return null;
    if (choices.length === 1) return choices[0];
    if (Object.keys(child.weights).length) {
      const weights = choices.map((c) => child.weights[c.name] ?? child.defaultWeight),
        sum = weights.reduce((s, n) => s + n, 0),
        value = Math.min(random.nextDouble(), 0.99999) * sum;
      let end = 0;
      for (let i = 0; i < weights.length; i++) {
        end += weights[i];
        if (value <= end) return choices[i];
      }
    }
    return choices[random.nextInt(choices.length)];
  }
  async generate(
    path,
    {
      chunk,
      seed,
      externalSeed,
      x,
      y,
      z,
      rotation = 0,
      fitHeightmap = false,
      blockMask = { type: 'ConstantBlockMask', result: true },
      environment = -2147483648,
      priority = 8,
      height,
      spawnCondition = () => true,
    },
  ) {
    const context = {
      chunk,
      seed,
      random: new this.I.FastRandom(externalSeed),
      childRandom: new this.I.FastRandom(externalSeed),
      blockMask,
      environment,
      priority,
      height,
      spawnCondition,
    };
    const state = {
      x,
      y,
      z,
      cx: (x - chunk.chunkX * 32) | 0,
      cz: (z - chunk.chunkZ * 32) | 0,
      rotation,
      fitHeightmap,
      specificSeed: Number(BigInt.asIntN(32, BigInt(externalSeed))),
      yOffset: 0,
      originHeight: 0,
      depth: 0,
    };
    await this.paste(path, context, state);
  }
  async paste(path, c, s) {
    const prefab = await this.data.load(path),
      chunk = c.chunk;
    if (s.fitHeightmap) {
      if (!c.height) throw Error('Heightmap required for fitted prefab');
      s.y = s.originHeight = c.height(s.x, s.z);
    }
    const children = [];
    this.iterator.forEach(prefab, {
      random: c.random,
      rotation: s.rotation,
      column: (x, z) => {
        const bx = x + s.cx,
          bz = z + s.cz;
        if (bx < 0 || bx >= 32 || bz < 0 || bz >= 32) return false;
        s.yOffset = s.fitHeightmap ? c.height((s.x + x) | 0, (s.z + z) | 0) - s.originHeight : 0;
        return true;
      },
      block: (b) => {
        if (c.blockMask.type === 'ConstantBlockMask' && !c.blockMask.result) return;
        const x = (b.x + s.cx) | 0,
          y = (b.y + s.y + s.yOffset) | 0,
          z = (b.z + s.cz) | 0;
        if (y < 0 || y >= 320) return;
        if (
          !this.mask(
            c.blockMask,
            chunk.getBlock(x, y, z),
            chunk.getFluid(x, y, z),
            b.block,
            b.fluid,
          )
        )
          return;
        chunk.setBlock(x, y, z, c.priority, b.block, b.rotation, b.filler);
        chunk.setFluid(x, y, z, c.priority, b.fluid, b.fluidLevel);
        chunk.setEnvironment(x, y, z, c.environment);
      },
      child: (child) => children.push(child),
    });
    chunk.markers ??= [];
    for (const marker of prefab.meta.markers) {
      const [mx, mz] = this.iterator.xz(Math.floor(marker.x), Math.floor(marker.z), s.rotation);
      if (mx + s.cx < 0 || mx + s.cx >= 32 || mz + s.cz < 0 || mz + s.cz >= 32) continue;
      const [rx, rz] = this.iterator.xz(marker.x - 0.5, marker.z - 0.5, s.rotation);
      chunk.markers.push({
        marker: marker.marker,
        x: rx + 0.5 + s.x,
        y: marker.y + s.y + (s.fitHeightmap ? c.height(s.x + mx, s.z + mz) - s.originHeight : 0),
        z: rz + 0.5 + s.z,
      });
    }
    for (const child of children) {
      if (s.depth >= 10) continue;
      const state = {
        ...s,
        depth: s.depth + 1,
        x: (s.x + child.x) | 0,
        y: (s.y + child.y) | 0,
        z: (s.z + child.z) | 0,
        cx: (s.cx + child.x) | 0,
        cz: (s.cz + child.z) | 0,
        fitHeightmap: child.fitHeightmap,
        rotation: (s.rotation + Number(child.rotation.slice(9)) / 90) % 4,
      };
      if (child.inheritSeed) {
        state.specificSeed = Number(
          BigInt.asIntN(32, this.I.hash(s.specificSeed, child.x, child.y, child.z)),
        );
        if (state.specificSeed === s.specificSeed)
          state.specificSeed = (state.specificSeed + 1) | 0;
      }
      if (s.fitHeightmap) state.y = (state.y + c.height(state.x, state.z) - s.originHeight) | 0;
      if (
        state.y >= 0 &&
        state.y < 320 &&
        state.cx >= 0 &&
        state.cx < 32 &&
        state.cz >= 0 &&
        state.cz < 32
      )
        chunk.setBlock(state.cx, state.y, state.cz, c.priority, 0);
      if (
        child.inheritHeightCondition &&
        !c.spawnCondition(c.seed, state.x, state.z, state.y, c.childRandom)
      )
        continue;
      const next = this.choose(child, c.childRandom);
      if (next) await this.paste(next.path, c, state);
    }
  }
}
globalThis.V1PrefabPaste = V1PrefabPaste;
if (typeof module !== 'undefined') module.exports = V1PrefabPaste;
