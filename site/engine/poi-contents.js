'use strict';
/** Read prefab anchor metadata without generating or downloading voxel buffers. */
class V1POIContents {
  constructor(k, data) {
    this.k = k;
    this.data = data;
  }
  canonical(path) {
    return path.replace(/\.(?:prefab\.json|lpf)$/, '');
  }
  keys(path) {
    return this.data.prefabs[this.canonical(path)]?.keys || [];
  }
  matches(path, selected) {
    return this.keys(path).some(
      (key) =>
        selected.has(key) || (this.data.types[key]?.aliases || []).some((a) => selected.has(a)),
    );
  }
  rotate(x, z, r) {
    return r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x];
  }
  expand(path, origin, selected) {
    const out = [],
      k = this.k;
    const visit = (path, s, depth) => {
      if (depth > 10) return;
      const p = this.data.prefabs[this.canonical(path)];
      if (!p) return;
      let y = s.fit ? k.terrainColumn(s.x, s.z).height : s.y;
      const originHeight = y;
      for (const q of p.points) {
        const keys = [q.key, ...(this.data.types[q.key]?.aliases || [])].filter((key) =>
          selected.has(key),
        );
        if (!keys.length) continue;
        const [dx, dz] = this.rotate(
            q.kind === 'mob' ? q.x - 0.5 : q.x,
            q.kind === 'mob' ? q.z - 0.5 : q.z,
            s.r,
          ),
          [columnX, columnZ] = this.rotate(Math.floor(q.x), Math.floor(q.z), s.r),
          offset = s.fit ? k.terrainColumn(s.x + columnX, s.z + columnZ).height - originHeight : 0;
        for (const key of keys)
          out.push({
            key,
            kind: q.kind,
            x: s.x + dx + (q.kind === 'mob' ? 0.5 : 0),
            y: y + q.y + offset,
            z: s.z + dz + (q.kind === 'mob' ? 0.5 : 0),
            source: 'prefab-anchor',
            confirmed: false,
          });
      }
      for (const c of p.children) {
        if (!this.matches(c.path, selected)) continue;
        const [dx, dz] = this.rotate(c.x, c.z, s.r),
          x = s.x + dx,
          z = s.z + dz,
          cy = y + c.y + (s.fit ? k.terrainColumn(x, z).height - originHeight : 0);
        visit(
          c.path,
          {
            x,
            y: cy,
            z,
            r: (s.r + Number(c.rotation.split('_')[1]) / 90) % 4,
            fit: c.fitHeightmap,
          },
          depth + 1,
        );
      }
    };
    visit(
      path,
      {
        x: origin.x,
        y: origin.y,
        z: origin.z,
        r:
          typeof origin.rotation === 'string'
            ? Number(origin.rotation.split('_')[1]) / 90
            : origin.rotation || 0,
        fit: !!origin.fitHeightmap,
      },
      0,
    );
    return out;
  }
}
globalThis.V1POIContents = V1POIContents;
if (typeof module !== 'undefined') module.exports = V1POIContents;
