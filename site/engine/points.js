'use strict';
function installV1Points(Kernel) {
  const N = typeof module !== 'undefined' ? require('./noise2d.js') : globalThis.SeedNoise;
  const P = Kernel.prototype;
  P.collectAllowed = function (e, hash, cx, cz) {
    if (e.type === 'DensityPointEvaluator' && !this.density(e.density, hash)) return false;
    if (e.type === 'SkipCellPointEvaluator') {
      const x = cx & e.mask,
        z = cz & e.mask;
      if (!((x === 0 && z === 0) || (e.mode === 'CHECKERBOARD' && x === e.mid && z === e.mid)))
        return false;
    }
    return e.pointEvaluator ? this.collectAllowed(e.pointEvaluator, hash, cx, cz) : true;
  };
  P.collectPoints = function (generator, minX, minZ, maxX, maxZ) {
    if (generator.type === 'DistortedPointGenerator')
      return this.collectPoints(generator.pointGenerator, minX, minZ, maxX, maxZ);
    if (generator.type === 'OffsetPointGenerator')
      return this.collectPoints(generator.generator, minX, minZ, maxX, maxZ).map((p) => ({
        x: p.x + generator.offsetX,
        z: p.z + generator.offsetY,
      }));
    let point = generator,
      outer = 1;
    if (generator.type === 'ScaledPointGenerator') {
      outer = generator.scale;
      minX *= outer;
      minZ *= outer;
      maxX *= outer;
      maxZ *= outer;
      point = generator.pointGenerator;
    }
    if (point.type !== 'PointGenerator' && point.type !== 'SeedResourcePointGenerator')
      throw Error('Unsupported point collector ' + point.type);
    let grid = point.cellDistanceFunction;
    const factor = this.gridScale(grid);
    minX *= factor;
    minZ *= factor;
    maxX *= factor;
    maxZ *= factor;
    while (grid.type === 'BorderDistanceFunction') grid = grid.distanceFunction;
    const hex = grid.type === 'HexCellDistanceFunction';
    if (!hex && grid.type !== 'GridCellDistanceFunction')
      throw Error('Unsupported cell collection ' + grid.type);
    const cell = (x, z) =>
      hex
        ? { x: Math.floor((Math.sqrt(3) / 3) * x - z / 3 + 0.5), z: Math.floor((2 / 3) * z + 0.5) }
        : { x: Math.floor(x), z: Math.floor(z) };
    const a = cell(minX, minZ),
      b = cell(maxX, maxZ),
      e = point.pointEvaluator,
      j = this.jitter(e),
      seed = (this.seed + point.seedOffset) | 0,
      points = [];
    const emit = (cx, cz) => {
      const hash = this.cellHash(grid, seed, cx, cz);
      if (!this.collectAllowed(e, hash, cx, cz)) return;
      const v = N.CELL2[hash & 255];
      let x = cx + (v[0] - (hex ? 0.5 : 0)) * j.jitterX,
        z = cz + (v[1] - (hex ? 0.5 : 0)) * j.jitterY;
      if (hex) {
        const hx = Math.sqrt(3) * x + (Math.sqrt(3) / 2) * z,
          hz = 1.5 * z;
        x = hx;
        z = hz;
        if (x < minX || x > maxX || z < minZ || z > maxZ) return;
        x /= factor;
        z /= factor;
      }
      points.push({ x: x / outer, z: z / outer });
    };
    if (hex) {
      const minY = a.z - 1,
        maxY = b.z + 1,
        minCellX = a.x - 1,
        maxCellX = b.x + 1,
        height = maxY - minY,
        width = maxCellX - minCellX + (height >> 1);
      for (let dy = 0; dy <= height; dy++) {
        const cz = minY + dy,
          start = minCellX - (dy >> 1);
        for (let dx = 0; dx <= width; dx++) emit(start + dx, cz);
      }
    } else for (let cz = a.z; cz <= b.z; cz++) for (let cx = a.x; cx <= b.x; cx++) emit(cx, cz);
    return points;
  };
}
if (typeof module !== 'undefined') module.exports = installV1Points;
else installV1Points(globalThis.V1Kernel);
