'use strict';

/** Decode one lossless ATPF file per prefab; keep a bounded numerical buffer cache. */
class V1PrefabData {
  constructor(
    manifest,
    { base = 'data/native-prefabs/', fetchFile, maxBytes = 32 * 1024 * 1024 } = {},
  ) {
    if (manifest.format !== 3 || manifest.recordBytes !== 44)
      throw Error('Unsupported numerical prefab format');
    this.manifest = manifest;
    this.base = base;
    this.maxBytes = maxBytes;
    this.cache = new Map();
    this.pending = new Map();
    this.bytes = 0;
    this.fetchFile =
      fetchFile ||
      (async (path) => {
        const response = await fetch(path);
        if (!response.ok) throw Error('Could not load prefab data (HTTP ' + response.status + ')');
        return new Uint8Array(await response.arrayBuffer());
      });
  }

  canonical(path) {
    return path.replace(/\.(?:prefab\.json|lpf)$/, '');
  }

  async load(path) {
    path = this.canonical(path);
    if (this.cache.has(path)) {
      const value = this.cache.get(path);
      this.cache.delete(path);
      this.cache.set(path, value);
      return value;
    }
    if (this.pending.has(path)) return this.pending.get(path);
    const job = this.read(path);
    this.pending.set(path, job);
    try {
      return await job;
    } finally {
      this.pending.delete(path);
    }
  }

  async read(path) {
    const record = this.manifest.prefabs[path];
    if (!record) throw Error('Missing numerical prefab ' + path);
    if (typeof DecompressionStream === 'undefined')
      throw Error('This browser cannot decompress map layer data');
    const file = await this.fetchFile(this.base + record.data + '.apf', 'binary');
    const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
    if (
      bytes.length < 9 ||
      bytes[0] !== 65 ||
      bytes[1] !== 84 ||
      bytes[2] !== 80 ||
      bytes[3] !== 70
    )
      throw Error('Invalid ATPF header');
    const metadataLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      4,
      true,
    );
    const blockOffset = 8 + metadataLength;
    if (blockOffset >= bytes.length) throw Error('Invalid ATPF metadata length');
    const inflate = (data) =>
      new Response(
        new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')),
      ).arrayBuffer();
    const [metadataBytes, buffer] = await Promise.all([
      inflate(bytes.subarray(8, blockOffset)),
      inflate(bytes.subarray(blockOffset)),
    ]);
    const meta = JSON.parse(new TextDecoder().decode(metadataBytes));
    if (buffer.byteLength !== meta.blockCount * 44)
      throw Error('Invalid numerical prefab block count');
    let total = 0;
    for (const [, , start, count] of meta.columns) {
      if (start !== total || count < 0) throw Error('Invalid prefab column order');
      total += count;
    }
    if (total !== meta.blockCount) throw Error('Incomplete prefab columns');
    const size = buffer.byteLength + metadataBytes.byteLength * 2;
    const value = { path, meta, view: new DataView(buffer), bytes: size };
    if (size <= this.maxBytes) {
      this.cache.set(path, value);
      this.bytes += size;
      while (this.bytes > this.maxBytes && this.cache.size) {
        const key = this.cache.keys().next().value;
        const old = this.cache.get(key);
        this.bytes -= old.bytes;
        this.cache.delete(key);
      }
    }
    return value;
  }

  block(data, index) {
    const b = index * 44,
      v = data.view;
    if (index < 0 || index >= data.meta.blockCount) throw Error('Invalid prefab record index');
    return {
      x: v.getInt32(b, true),
      y: v.getInt32(b + 4, true),
      z: v.getInt32(b + 8, true),
      block: v.getInt32(b + 12, true),
      mask: v.getInt32(b + 16, true),
      chance: v.getFloat32(b + 20, true),
      support: v.getInt32(b + 24, true),
      rotation: v.getInt32(b + 28, true),
      filler: v.getInt32(b + 32, true),
      fluid: v.getInt32(b + 36, true),
      fluidLevel: v.getInt32(b + 40, true),
    };
  }

  clear() {
    this.cache.clear();
    this.bytes = 0;
  }
}
globalThis.V1PrefabData = V1PrefabData;
if (typeof module !== 'undefined') module.exports = V1PrefabData;
