'use strict';
/** Numeric block state for a single 32 x 320 x 32 V1 chunk, without meshes. */
class V1ChunkState {
  constructor(chunkX, chunkZ) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    const n = 32 * 320 * 32;
    this.blocks = new Int32Array(n);
    this.fluids = new Int32Array(n);
    this.environments = new Int32Array(n);
    this.priorities = new Int8Array(n);
    this.rotations = new Uint8Array(n);
    this.fillers = new Uint16Array(n);
    this.fluidLevels = new Uint8Array(n);
    this.allocatedSections = new Uint8Array(10);
    this.caveModifier = false;
  }
  index(x, y, z) {
    if (x < 0 || x >= 32 || z < 0 || z >= 32 || y < 0 || y >= 320 || !Number.isInteger(x + y + z))
      throw Error('Outside numeric chunk');
    return (y * 32 + z) * 32 + x;
  }
  priority(index, type) {
    type = (type << 24) >> 24;
    const old = this.priorities[index] & 31;
    let next = type & 31,
      current = old;
    if (this.caveModifier) {
      if (old === 8 && next === 6) current = 6;
      else if (old === 6 && next === 5) current = 5;
    }
    if (type === -1) next = current;
    if (next < current) return false;
    if (this.caveModifier && old === 8 && next === 6) next = 8;
    this.priorities[index] = next | (type & ~31);
    return true;
  }
  setBlock(x, y, z, type, block, rotation = 0, filler = 0) {
    if (y < 0 || y >= 320) return false;
    const i = this.index(x, y, z);
    if (!this.priority(i, type)) return false;
    if (!this.allocatedSections[y >> 5]) {
      if (!block) return true;
      this.allocatedSections[y >> 5] = 1;
    }
    this.blocks[i] = block;
    this.rotations[i] = rotation;
    this.fillers[i] = filler;
    return true;
  }
  setFluid(x, y, z, type, fluid, level = 0) {
    if (y < 0 || y >= 320) return false;
    const i = this.index(x, y, z);
    if (!this.priority(i, type)) return false;
    this.fluids[i] = fluid;
    this.fluidLevels[i] = level;
    return true;
  }
  setEnvironment(x, y, z, environment) {
    if (environment !== -2147483648) this.environments[this.index(x, y, z)] = environment;
  }
  getBlock(x, y, z) {
    return this.blocks[this.index(x, y, z)];
  }
  getFluid(x, y, z) {
    return this.fluids[this.index(x, y, z)];
  }
}
globalThis.V1ChunkState = V1ChunkState;
if (typeof module !== 'undefined') module.exports = V1ChunkState;
