'use strict';
function installV1Properties3(Kernel) {
  const N = typeof module !== 'undefined' ? require('./noise3d.js') : globalThis.V1Noise3,
    P = Kernel.prototype,
    limit = (x) => Math.max(0, Math.min(1, x));
  P.function3 = function (node, seed, offset, x, y, z) {
    switch (node.type) {
      case 'OldSimplexNoise':
        return N.oldSimplex3(seed, offset, x, y, z);
      case 'SimplexNoise':
        return N.simplex3(seed, offset, x, y, z);
      case 'ConstantNoise':
        return node.value;
      case 'PointNoise': {
        const dx = x - node.x,
          dy = y - node.y,
          dz = z - node.z,
          d = dx * dx + dy * dy + dz * dz;
        if (d <= node.innerRadius2) return -1;
        if (d >= node.outerRadius2) return 1;
        return -1 + 2 * (d - node.innerRadius2) * node.invRange2;
      }
      default:
        throw Error('Unsupported 3D noise function ' + node.type);
    }
  };
  P.randomize3 = function (node, seed, x, y, z) {
    if (!node) return { x, y, z };
    if (node.type === 'CoordinateRotator') {
      const m = node.matrix;
      return {
        x: x * m[0] + y * m[1] + z * m[2],
        y: x * m[3] + y * m[4] + z * m[5],
        z: x * m[6] + y * m[7] + z * m[8],
      };
    }
    const axis = (entries) => {
      let v = 0;
      for (const p of entries || [])
        v += (this.noise3(p.property, seed, x, y, z) * 2 - 1) * p.amplitude;
      return v;
    };
    return { x: x + axis(node.xNoise), y: y + axis(node.yNoise), z: z + axis(node.zNoise) };
  };
  P.noise3 = function (node, seed, x, y, z) {
    switch (node.type) {
      case 'ScaleNoiseProperty':
        return this.noise3(
          node.noiseProperty,
          seed,
          x * node.scaleX,
          y * node.scaleY,
          z * node.scaleZ,
        );
      case 'OffsetNoiseProperty':
        return this.noise3(
          node.noiseProperty,
          seed,
          x + node.offsetX,
          y + node.offsetY,
          z + node.offsetZ,
        );
      case 'RotateNoiseProperty': {
        const p = this.randomize3(node.rotation, seed, x, y, z);
        return this.noise3(node.noise, seed, p.x, p.y, p.z);
      }
      case 'DistortedNoiseProperty': {
        const p = this.randomize3(node.randomizer, seed, x, y, z);
        return this.noise3(node.noiseProperty, seed, p.x, p.y, p.z);
      }
      case 'SingleNoiseProperty':
        return limit(
          this.function3(node.function, seed, (seed + node.seedOffset) | 0, x, y, z) * 0.5 + 0.5,
        );
      case 'FractalNoiseProperty': {
        const mode = Number(node.fractalFunction.type.split('$').at(-1));
        let offset = (seed + node.seedOffset) | 0,
          amp = 1,
          sum = 0;
        if (mode === 4) {
          let total = 0,
            freq = 1;
          for (let i = 0; i < node.octaves; i++) {
            sum +=
              this.function3(node.function, (seed - 1) | 0, offset, x * freq, y * freq, z * freq) *
              amp;
            offset = (offset + 1) | 0;
            total += amp;
            amp *= node.persistence;
            freq <<= 1;
          }
          return (sum / total) * 0.5 + 0.5;
        }
        sum = this.function3(node.function, seed, offset, x, y, z);
        if (mode === 2) sum = Math.abs(sum) * 2 - 1;
        if (mode === 3) sum = 1 - Math.abs(sum);
        for (let i = 1; i < node.octaves; i++) {
          offset = (offset + 1) | 0;
          x *= node.lacunarity;
          y *= node.lacunarity;
          if (mode !== 5 && mode !== 6) z *= node.lacunarity;
          const v = this.function3(node.function, seed, offset, x, y, z);
          amp *= node.persistence;
          if (mode === 1) sum += v * amp;
          else if (mode === 2) sum += (Math.abs(v) * 2 - 1) * amp;
          else if (mode === 3) sum -= (1 - Math.abs(v)) * amp;
          else if (mode === 5) sum = Math.min(sum, v);
          else if (mode === 6) sum = Math.max(sum, v);
          else throw Error('Unsupported 3D fractal mode ' + mode);
        }
        return limit(sum * 0.5 + 0.5);
      }
      case 'NoiseFormulaProperty':
        return this.formula(node.formula.type, this.noise3(node.property, seed, x, y, z));
      case 'NormalizeNoiseProperty':
        return limit((this.noise3(node.noiseProperty, seed, x, y, z) - node.min) / node.range);
      case 'InvertNoiseProperty':
        return 1 - this.noise3(node.noiseProperty, seed, x, y, z);
      case 'SumNoiseProperty': {
        let v = 0;
        for (const e of node.entries) v += this.noise3(e.noiseProperty, seed, x, y, z) * e.factor;
        return limit(v);
      }
      case 'MultiplyNoiseProperty': {
        let v = this.noise3(node.noiseProperties[0], seed, x, y, z);
        for (let i = 1; i < node.noiseProperties.length; i++)
          v *= this.noise3(node.noiseProperties[i], seed, x, y, z);
        return v;
      }
      case 'MinNoiseProperty': {
        let v = this.noise3(node.noiseProperties[0], seed, x, y, z);
        for (let i = 1; i < node.noiseProperties.length; i++) {
          if (v < 1e-5) return 0;
          v = Math.min(v, this.noise3(node.noiseProperties[i], seed, x, y, z));
        }
        return v;
      }
      case 'MaxNoiseProperty': {
        let v = this.noise3(node.noiseProperties[0], seed, x, y, z);
        for (let i = 1; i < node.noiseProperties.length; i++) {
          if (v > 0.999999) return 1;
          v = Math.max(v, this.noise3(node.noiseProperties[i], seed, x, y, z));
        }
        return v;
      }
      case 'CurveNoiseProperty': {
        const n = 1 - this.noise3(node.noise, seed, x, y, z);
        return 1 - Math.pow(n, node.function.a + node.function.b * n);
      }
      case 'BlendNoiseProperty': {
        const a = this.noise3(node.alpha, seed, x, y, z),
          t = node.thresholds,
          p = node.noises;
        if (!p.length) return 0;
        if (a <= t[0]) return this.noise3(p[0], seed, x, y, z);
        if (a >= t.at(-1)) return this.noise3(p.at(-1), seed, x, y, z);
        for (let i = 1; i < p.length; i++)
          if (a <= t[i]) {
            const lo = this.noise3(p[i - 1], seed, x, y, z),
              hi = this.noise3(p[i], seed, x, y, z);
            return lo + (hi - lo) * (a - t[i - 1]) * node.normalize[i];
          }
        return 0;
      }
      default:
        throw Error('Unsupported 3D noise property ' + node.type);
    }
  };
}
if (typeof module !== 'undefined') module.exports = installV1Properties3;
else installV1Properties3(globalThis.V1Kernel);
