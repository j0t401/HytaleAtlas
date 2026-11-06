'use strict';
function installCompiledNoise(Kernel) {
  const original = Kernel.prototype.noise,
    cache = new WeakMap(),
    N = typeof module !== 'undefined' ? require('./noise2d.js') : globalThis.SeedNoise,
    limit = N.limit;
  function compile(n, k) {
    if (cache.has(n)) return cache.get(n);
    let f;
    const child = (v) => compile(v, k),
      fun = n.function,
      raw =
        fun?.type === 'OldSimplexNoise'
          ? (s, o, x, y) => N.oldSimplex(s, o, x, y)
          : fun?.type === 'SimplexNoise'
            ? (s, o, x, y) => N.simplex(s, o, x, y)
            : fun?.type === 'ConstantNoise'
              ? () => fun.value
              : fun
                ? (s, o, x, y) => k.function(fun, s, o, x, y)
                : null;
    if (n.type === 'ScaleNoiseProperty') {
      const a = child(n.noiseProperty);
      f = (s, x, y) => a(s, x * n.scaleX, y * n.scaleY);
    } else if (n.type === 'OffsetNoiseProperty') {
      const a = child(n.noiseProperty);
      f = (s, x, y) => a(s, x + n.offsetX, y + n.offsetY);
    } else if (n.type === 'SingleNoiseProperty')
      f = (s, x, y) => limit(raw(s, (s + n.seedOffset) | 0, x, y) * 0.5 + 0.5);
    else if (
      n.type === 'FractalNoiseProperty' &&
      ['1', '5', '6'].includes(n.fractalFunction.type.split('$').at(-1))
    ) {
      const mode = Number(n.fractalFunction.type.split('$').at(-1));
      f = (s, x, y) => {
        let offset = (s + n.seedOffset) | 0,
          amp = 1,
          sum = raw(s, offset, x, y);
        for (let i = 1; i < n.octaves; i++) {
          offset = (offset + 1) | 0;
          x *= n.lacunarity;
          y *= n.lacunarity;
          if (mode === 1) {
            amp *= n.persistence;
            sum += raw(s, offset, x, y) * amp;
          } else {
            const v = raw(s, offset, x, y);
            sum = mode === 5 ? Math.min(sum, v) : Math.max(sum, v);
          }
        }
        return limit(sum * 0.5 + 0.5);
      };
    } else if (n.type === 'InvertNoiseProperty') {
      const a = child(n.noiseProperty);
      f = (s, x, y) => 1 - a(s, x, y);
    } else if (n.type === 'NormalizeNoiseProperty') {
      const a = child(n.noiseProperty);
      f = (s, x, y) => limit((a(s, x, y) - n.min) / n.range);
    } else if (n.type === 'SumNoiseProperty') {
      const a = n.entries.map((e) => [child(e.noiseProperty), e.factor]);
      f = (s, x, y) => {
        let v = 0;
        for (const [fn, factor] of a) v += fn(s, x, y) * factor;
        return limit(v);
      };
    } else if (n.type === 'MultiplyNoiseProperty') {
      const a = n.noiseProperties.map(child);
      f = (s, x, y) => {
        let v = a[0](s, x, y);
        for (let i = 1; i < a.length; i++) v *= a[i](s, x, y);
        return v;
      };
    } else if (n.type === 'MinNoiseProperty' || n.type === 'MaxNoiseProperty') {
      const a = n.noiseProperties.map(child),
        min = n.type === 'MinNoiseProperty';
      f = (s, x, y) => {
        let v = a[0](s, x, y);
        for (let i = 1; i < a.length; i++) {
          if (min && v < 1e-5) return 0;
          if (!min && v > 0.999999) return 1;
          v = min ? Math.min(v, a[i](s, x, y)) : Math.max(v, a[i](s, x, y));
        }
        return v;
      };
    } else if (n.type === 'NoiseFormulaProperty') {
      const a = child(n.property),
        mode = Number(n.formula.type.split('$').at(-1)),
        funcs = [
          null,
          (v) => v,
          (v) => 1 - v,
          (v) => v * v,
          (v) => 1 - v * v,
          (v) => Math.sqrt(v),
          (v) => 1 - Math.sqrt(v),
          (v) => Math.abs(v - 0.5),
          (v) => 1 - Math.abs(v - 0.5),
          (v) => Math.sqrt(Math.abs(v - 0.5)),
          (v) => 1 - Math.sqrt(Math.abs(v - 0.5)),
          (v) => Math.abs(v * 2 - 1),
          (v) => 1 - Math.abs(v * 2 - 1),
          (v) => Math.sqrt(Math.abs(v * 2 - 1)),
          (v) => 1 - Math.sqrt(Math.abs(v * 2 - 1)),
          (v) => Math.abs(v * 2 - 1) ** 2,
        ];
      if (funcs[mode]) f = (s, x, y) => funcs[mode](a(s, x, y));
    }
    if (!f) f = (s, x, y) => original.call(k, n, s, x, y);
    cache.set(n, f);
    return f;
  }
  Kernel.prototype.noise = function (node, seed, x, y) {
    return compile(node, this)(seed, x, y);
  };
}
if (typeof module !== 'undefined') module.exports = installCompiledNoise;
else installCompiledNoise(globalThis.V1Kernel);
