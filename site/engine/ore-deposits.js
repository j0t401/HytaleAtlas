'use strict';
/** Query native ore-filling geometry without generating all world voxels. */
class V1OreDeposits {
  constructor(kernel, caves, profile) {
    this.k = kernel;
    this.caves = caves;
    this.profile = profile;
  }
  query(task, selected) {
    const k = this.k,
      c = this.caves,
      size = task.size || 512,
      points = [];
    for (const source of this.profile.sources) {
      if (!source.keys.some((key) => selected.has(key))) continue;
      const type = c.zones.get(source.zone)?.caves?.caveTypes[source.typeIndex];
      if (!type || type.name !== source.name)
        throw Error('Ore source profile does not match native cave geometry');
      const radius = type.maximumSize;
      for (const point of k.collectPoints(
        type.pointGenerator,
        task.x - radius,
        task.z - radius,
        task.x + size - 1 + radius,
        task.z + size - 1 + radius,
      )) {
        const x = Math.floor(point.x),
          z = Math.floor(point.z);
        if (k.at(x, z).zone !== source.zone || !k.condition(type.mapCondition, x, z)) continue;
        const height = k.terrainColumn(x, z).height;
        if (!c.condition(type.heightCondition, (k.seed - 173220171) | 0, x, height, z)) continue;
        for (const node of c.generate(type, x, z)) {
          const keys = (source.nodeOres[node.type.name] || []).filter((key) => selected.has(key));
          if (!keys.length || !['Ellipsoid', 'Pipe'].includes(node.shape.kind)) continue;
          const bounds = node.shape.bounds,
            minY = Math.max(0, bounds[1]),
            maxY = Math.min(319, bounds[4]);
          if (maxY < minY) continue;
          const px = Math.floor((bounds[0] + bounds[3]) / 2),
            pz = Math.floor((bounds[2] + bounds[5]) / 2);
          if (px < task.x || px >= task.x + size || pz < task.z || pz >= task.z + size) continue;
          let py = -1;
          const middle = Math.floor((minY + maxY) / 2);
          for (let offset = 0; offset <= maxY - minY && py < 0; offset++)
            for (const y of offset ? [middle + offset, middle - offset] : [middle])
              if (y >= minY && y <= maxY && c.replaces(type, node.shape, px, y, pz)) {
                py = y;
                break;
              }
          if (py < 0) continue;
          for (const key of keys)
            points.push({
              key,
              kind: 'ore',
              x: px,
              y: py,
              z: pz,
              minY,
              maxY,
              bounds,
              zone: source.zone,
              source: 'ore-deposit',
              confirmed: false,
              depositId:
                source.zone +
                '/' +
                source.typeIndex +
                '/' +
                x +
                '/' +
                z +
                '/' +
                node.seedOffset +
                '/' +
                key,
            });
        }
      }
    }
    return points;
  }
}
globalThis.V1OreDeposits = V1OreDeposits;
if (typeof module !== 'undefined') module.exports = V1OreDeposits;
