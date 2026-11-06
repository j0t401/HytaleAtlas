'use strict';
/** Cave geometry pass only. Decoration, carving and final block placement are separate passes. */
class V1Caves {
  constructor(kernel, raw, prefabs, trig) {
    this.kernel = kernel;
    this.data = kernel.constructor.decodeGraph(raw).data;
    this.zones = new Map(this.data.zones.map((z) => [z.name, z]));
    this.prefabs = prefabs;
    this.trig = trig;
    this.I = typeof module !== 'undefined' ? require('./random.js') : globalThis.V1Integer;
  }
  range(r, rng, force = false) {
    return this.kernel.range(
      r,
      force ? rng.nextDouble() : r.type === 'DoubleRange$Constant' ? 0 : rng.nextDouble(),
    );
  }
  floatRange(r, rng) {
    if (r.type === 'FloatRange$Constant') return r.result;
    if (r.type === 'FloatRange$Normal')
      return Math.fround(r.min + Math.fround(r.range * rng.nextFloat()));
    throw Error('Unsupported float range ' + r.type);
  }
  choose(w, rng) {
    return w.weighted.length === 1 ? w.weighted[0][0] : this.kernel.weighted(w, rng.nextDouble());
  }
  intCondition(c, v) {
    if (c.type === 'ConstantIntCondition') return c.result;
    if (c.type === 'HashSetIntCondition') return c.set.includes(v);
    throw Error('Unsupported biome condition ' + c.type);
  }
  flags(mask, x, z) {
    if (mask.type === 'ConstantInt2Flags') return mask.result;
    if (mask.type !== 'CompositeInt2Flags') throw Error('Unsupported cave flags ' + mask.type);
    const id = this.kernel.at(Math.floor(x), Math.floor(z)).biomeId;
    let value = mask.defaultResult;
    for (const e of mask.flags)
      if (this.intCondition(e.condition, id)) {
        if (e.operator === 'And') value &= e.flags;
        else if (e.operator === 'Or') value |= e.flags;
        else if (e.operator === 'Xor') value ^= e.flags;
        else throw Error('Unsupported flags operator');
      }
    return value;
  }
  threshold(node, seed, x, z, y, context) {
    const F = Math.fround,
      k = this.kernel;
    if (y > node.highestNonZero) return 0;
    if (node.type === 'BasicHeightThresholdInterpreter')
      return node.interpolatedThresholds[
        Math.max(0, Math.min(y, node.interpolatedThresholds.length - 1))
      ];
    if (node.type !== 'NoiseHeightThresholdInterpreter')
      throw Error('Unsupported cave height interpreter ' + node.type);
    context ??= k.noise(node.noise, seed, x, z);
    const t = node.keys,
      p = node.values;
    for (let i = 0; i < t.length; i++)
      if (context <= t[i]) {
        if (i === 0) return this.threshold(p[0], seed, x, z, y);
        const v = F(F(F(context) - t[i - 1]) / F(t[i] - t[i - 1])),
          a = this.threshold(p[i - 1], seed, x, z, y),
          b = this.threshold(p[i], seed, x, z, y);
        return F(a + F(F(b - a) * v));
      }
    return this.threshold(p.at(-1), seed, x, z, y);
  }
  condition(c, seed, x, y, z) {
    const k = this.kernel;
    switch (c.type) {
      case 'DefaultCoordinateCondition':
        return c.result;
      case 'HeightThresholdCoordinateCondition': {
        const f = (v) => (v >= 0 ? Math.trunc(v) : Math.trunc(v) - 1);
        return (
          this.threshold(c.interpreter, seed, x, z, y) >= this.I.random(seed, f(x), f(y), f(z))
        );
      }
      case 'RandomCoordinateCondition':
        return this.I.random(seed, x, y, z) <= c.chance;
      case 'NoiseMaskCondition':
        return k.threshold(c.condition, k.noise3(c.noiseMask, seed, x, y, z));
      default:
        throw Error('Unsupported cave coordinate condition ' + c.type);
    }
  }
  orientation(m, current, rng) {
    if (m.type !== 'OrientationModifier') throw Error('Orientation semantics were not exported');
    if (m.mode === 'KEEP') return current;
    const v = this.floatRange(m.range, rng);
    if (m.mode === 'SET') return v;
    if (m.mode === 'ADD') return Math.fround(current + v);
    throw Error('Unsupported orientation mode');
  }
  rotate(v, rotation) {
    const [x, y, z] = v;
    switch (rotation) {
      case 'ROTATION_0':
        return [x, y, z];
      case 'ROTATION_90':
        return [z, y, -x];
      case 'ROTATION_180':
        return [-x, y, -z];
      case 'ROTATION_270':
        return [-z, y, x];
      default:
        throw Error('Unsupported cave prefab rotation');
    }
  }
  radial(center, radii, direction) {
    const len = direction.reduce((s, v) => s + v * v, 0);
    if (len === 0) return center.slice();
    const inv = Math.sqrt(1 / len);
    return center.map((v, i) => v + Math.abs(direction[i]) * radii[i] * inv * direction[i]);
  }
  radiusAt(s, t) {
    return t <= 0.5
      ? (s.middle - s.r1) * 2 * t + s.r1
      : (s.r2 - s.middle) * 2 * (t - 0.5) + s.middle;
  }
  replaces(type, s, x, y, z) {
    if (s.kind === 'Prefab' || s.kind === 'EmptyLine') return false;
    if (s.kind === 'Ellipsoid') {
      const d = [x - s.o[0], y - s.o[1], z - s.o[2]],
        t = this.threshold(type.heightFactors, this.kernel.seed, x, z, y);
      return d.reduce((v, p, i) => v + (p / s.r[i]) * (p / s.r[i]), 0) <= t * t;
    }
    if (s.kind === 'Pipe') {
      const p = [x, y, z],
        length = s.v.reduce((v, x) => v + x * x, 0),
        t = p.reduce((v, x, i) => v + (x - s.o[i]) * s.v[i], 0) / length;
      let center, r;
      if (t < 0) {
        center = s.o;
        r = s.r1;
      } else if (t > 1) {
        center = s.end;
        r = s.r2;
      } else {
        center = s.o.map((v, i) => v + s.v[i] * t);
        r = this.radiusAt(s, t);
      }
      r *= this.threshold(type.heightFactors, this.kernel.seed, x, z, Math.floor(center[1]));
      return p.reduce((v, x, i) => v + (center[i] - x) * (center[i] - x), 0) < r * r;
    }
    throw Error('Unsupported cave carving shape ' + s.kind);
  }
  floor(type, s, x, z) {
    if (s.kind === 'Prefab') throw Error('Prefab floor requires block-column data');
    const hi = s.kind === 'Ellipsoid' ? s.o[1] : s.bounds[4];
    for (let y = s.bounds[1]; y < hi; y++) if (this.replaces(type, s, x, y, z)) return y - 1;
    return -1;
  }
  ceiling(type, s, x, z) {
    if (s.kind === 'Prefab') throw Error('Prefab ceiling requires block-column data');
    const lo = s.kind === 'Ellipsoid' ? s.o[1] : s.bounds[1];
    for (let y = s.bounds[4]; y > lo; y--) if (this.replaces(type, s, x, y, z)) return y + 1;
    return -1;
  }
  anchor(s, a) {
    const [tx, ty, tz] = a;
    if (s.kind === 'Prefab')
      return s.bounds.slice(0, 3).map((v, i) => v + (s.bounds[i + 3] - v) * a[i]);
    if (s.kind === 'EmptyLine') return s.o.map((v, i) => v + s.v[i] * tx);
    if (s.kind === 'Ellipsoid')
      return this.radial(
        s.o,
        s.r,
        a.map((v) => v * 2 - 1),
      );
    if (s.kind === 'Pipe') {
      const center = s.o.map((v, i) => v + s.v[i] * tx),
        len = Math.sqrt(s.v.reduce((v, x) => v + x * x, 0)),
        [nx, ny, nz] = s.v.map((v) => v / len),
        fv = 2 * ty - 1,
        fh = 2 * tz - 1,
        r = this.radiusAt(s, tx);
      return this.radial(center, [r, r, r], [-ny * fv - nz * fh, nx * fv, nx * fh]);
    }
    throw Error('Unsupported cave anchor');
  }
  childOrigin(parent, entry) {
    const a = [entry.anchor.x, entry.anchor.y, entry.anchor.z];
    if (a.every((v) => v === 0)) return parent.shape.end.slice();
    let t = a;
    if (parent.shape.rotation && parent.shape.rotation !== 'ROTATION_0')
      t = this.rotate(
        a.map((v) => v - 0.5),
        parent.shape.rotation,
      ).map((v) => v + 0.5);
    return this.anchor(parent.shape, t);
  }
  shape(generator, type, parent, entry, origin, yaw, pitch, rng) {
    const o = origin.slice(),
      rotationList = ['ROTATION_0', 'ROTATION_90', 'ROTATION_180', 'ROTATION_270'];
    const offset = () => {
      let v = entry ? [entry.offset.x, entry.offset.y, entry.offset.z] : [0, 0, 0];
      if (parent?.shape.rotation) v = this.rotate(v, parent.shape.rotation);
      for (let i = 0; i < 3; i++) o[i] += v[i];
    };
    const direction = () => {
      const l = this.range(generator.length, rng, true),
        sin = this.trig.sin(pitch);
      return [
        Math.fround(sin * this.trig.cos(yaw)) * l,
        this.trig.cos(pitch) * l,
        Math.fround(sin * this.trig.sin(yaw)) * l,
      ];
    };
    switch (generator.type) {
      case 'EmptyLineCaveNodeShape$EmptyLineCaveNodeShapeGenerator': {
        const v = direction();
        return {
          kind: 'EmptyLine',
          o,
          v,
          end: o.map((p, i) => p + v[i]),
          bounds: [0, 0, 0, 0, 0, 0],
          geometry: false,
        };
      }
      case 'PrefabCaveNodeShape$PrefabCaveNodeShapeGenerator': {
        const prefab = generator.prefabs[rng.nextInt(generator.prefabs.length)];
        let rotation;
        if (!parent) rotation = rotationList[rng.nextInt(4)];
        else {
          rotation =
            entry.rotation.length === 1
              ? entry.rotation[0]
              : entry.rotation[rng.nextInt(entry.rotation.length)];
          if (parent.shape.rotation)
            rotation =
              rotationList[
                (rotationList.indexOf(rotation) + rotationList.indexOf(parent.shape.rotation)) % 4
              ];
          offset();
        }
        const info = this.prefabs.prefabs[prefab.path];
        if (!info) throw Error('Missing cave prefab geometry ' + prefab.path);
        const b = info.boundsWithChildren || info.bounds || [0, 0, 0, 0, 0, 0];
        const corners = [];
        for (const x of [b[0], b[3]])
          for (const z of [b[2], b[5]]) corners.push(this.rotate([x, 0, z], rotation));
        const bounds = [
          Math.floor(o[0] + Math.min(...corners.map((v) => v[0]))),
          Math.floor(o[1] + b[1]),
          Math.floor(o[2] + Math.min(...corners.map((v) => v[2]))),
          Math.ceil(o[0] + Math.max(...corners.map((v) => v[0]))),
          Math.ceil(o[1] + b[4]),
          Math.ceil(o[2] + Math.max(...corners.map((v) => v[2]))),
        ];
        return {
          kind: 'Prefab',
          o,
          end: o.slice(),
          bounds,
          geometry: bounds.slice(0, 3).every((v, i) => bounds[i + 3] > v),
          prefabPath: prefab.path,
          rotation,
        };
      }
      case 'PipeCaveNodeShape$PipeCaveNodeShapeGenerator': {
        const v = direction(),
          r1 = generator.inheritParentRadius
            ? parent?.shape.kind === 'Pipe'
              ? parent.shape.r2
              : this.range(generator.radius, rng)
            : this.range(generator.radius, rng, true),
          r2 = this.range(generator.radius, rng, true);
        let middle = (r2 - r1) * 0.5 + r1;
        if (generator.middleRadius) middle = this.range(generator.middleRadius, rng, true);
        offset();
        const end = o.map((p, i) => p + v[i]),
          rad = Math.max(r1, r2),
          bounds = o
            .map((p, i) => Math.floor(Math.min(p, end[i]) - rad))
            .concat(o.map((p, i) => Math.ceil(Math.max(p, end[i]) + rad)));
        return {
          kind: 'Pipe',
          o,
          v,
          end,
          r1,
          r2,
          middle,
          bounds,
          geometry: bounds.slice(0, 3).every((v, i) => bounds[i + 3] > v),
        };
      }
      case 'EllipsoidCaveNodeShape$EllipsoidCaveNodeShapeGenerator': {
        const r = [
          this.range(generator.radiusX, rng),
          this.range(generator.radiusY, rng),
          this.range(generator.radiusZ, rng),
        ];
        offset();
        const bounds = o
          .map((p, i) => Math.floor(Math.min(p - r[i], p + r[i])))
          .concat(o.map((p, i) => Math.ceil(Math.max(p - r[i], p + r[i]))));
        return {
          kind: 'Ellipsoid',
          o,
          end: [o[0], bounds[1], o[2]],
          r,
          bounds,
          geometry: bounds.slice(0, 3).every((v, i) => bounds[i + 3] > v),
        };
      }
      default:
        throw Error('Unsupported cave shape generator ' + generator.type);
    }
  }
  generate(type, x, z) {
    const k = this.kernel,
      seed = k.seed,
      height = k.terrainColumn(x, z).height,
      offset = Number(BigInt.asIntN(32, this.I.mix(this.I.hash(seed, x, height, z)))),
      rng = new this.I.FastRandom(offset),
      origin = [x, height, z],
      nodes = [];
    if (type.fixedEntryHeight)
      origin[1] = Math.floor(
        type.fixedEntryHeightNoise
          ? k.range(
              type.fixedEntryHeight,
              k.noise(type.fixedEntryHeightNoise, (seed + offset) | 0, x, z),
            )
          : this.range(type.fixedEntryHeight, rng),
      );
    const initial = this.flags(type.biomeMask, origin[0], origin[2]);
    if (!(initial & 1)) return nodes;
    const depth = Math.floor(this.floatRange(type.depth, rng)),
      yaw = this.floatRange(type.yaw, rng),
      pitch = this.floatRange(type.pitch, rng),
      hash = rng.nextInt(),
      shape = this.shape(
        type.entryNodeType.shapeGenerator,
        type,
        null,
        null,
        origin,
        yaw,
        pitch,
        rng,
      ),
      last = this.flags(type.biomeMask, shape.end[0], shape.end[2]);
    if (!(last & 1)) return nodes;
    const root = {
      type: type.entryNodeType,
      shape,
      yaw,
      pitch,
      seedOffset: (seed + hash) | 0,
      isRoot: true,
    };
    if (shape.geometry && initial & 2 && last & 2) nodes.push(root);
    const continueNode = (parent, depth) => {
      if (depth <= 0) return;
      let children = parent.type.children;
      if (parent.type.childrenCountBounds && children.length) {
        children = children.slice();
        for (let i = children.length - 1; i > 0; i--) {
          const j = rng.nextInt(i + 1);
          [children[i], children[j]] = [children[j], children[i]];
        }
      }
      const count = parent.type.childrenCountBounds
        ? Math.floor(this.range(parent.type.childrenCountBounds, rng))
        : 2147483647;
      let generated = 0;
      entries: for (const entry of children) {
        const repeat = Math.floor(this.range(entry.repeat, rng));
        for (let i = 0; i < repeat; i++) {
          if (!(rng.nextDouble() < entry.chance)) continue;
          if (generated >= count) return;
          const origin = this.childOrigin(parent, entry),
            child = this.choose(entry.types, rng);
          if (!this.condition(child.heightCondition, seed, ...origin.map(Math.floor))) continue;
          let yaw = parent.yaw;
          if (entry.yawMode !== 'NODE' && parent.shape.rotation) {
            const angle = -rotationNumber(parent.shape.rotation) * Math.fround(Math.PI / 2);
            yaw =
              entry.yawMode === 'SUM' ? Math.fround(yaw + Math.fround(angle)) : Math.fround(angle);
          }
          yaw = this.orientation(entry.yawModifier, yaw, rng);
          const pitch = this.orientation(entry.pitchModifier, parent.pitch, rng),
            hash = rng.nextInt(),
            shape = this.shape(child.shapeGenerator, type, parent, entry, origin, yaw, pitch, rng);
          if (!this.condition(child.heightCondition, seed, ...shape.end.map(Math.floor))) continue;
          const flags = this.flags(type.biomeMask, shape.end[0], shape.end[2]);
          if (!(flags & 1)) {
            if (!(flags & 4)) continue entries;
            continue;
          }
          const node = {
            type: child,
            shape,
            yaw,
            pitch,
            seedOffset: hash,
            parentShape: parent.shape,
          };
          if (shape.geometry && flags & 2) nodes.push(node);
          let next = depth - 1;
          if (entry.childrenLimit)
            next = Math.min(next, Math.floor(this.range(entry.childrenLimit, rng)));
          continueNode(node, next);
          generated++;
        }
      }
    };
    continueNode(root, depth);
    return nodes;
  }
}
function rotationNumber(rotation) {
  return Number(rotation.split('_')[1]) / 90;
}
globalThis.V1Caves = V1Caves;
if (typeof module !== 'undefined') module.exports = V1Caves;
