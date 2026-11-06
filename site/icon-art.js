'use strict';
/** Shared visual treatment for supplied PNGs: fixed size, dark backing and rarity ring. */
const AtlasIconArt = (() => {
  let entries = {};
  const images = new Map();
  const colors = {
    Common: '#bac7d2',
    Uncommon: '#70d99b',
    Rare: '#74acff',
    Epic: '#c698ff',
    Legendary: '#f0c46b',
    Unclassified: '#8195a8',
  };
  function url(key, kind) {
    if (entries[key]) return entries[key];
    if (key.startsWith('container:')) return entries['container:all'];
    if (key.includes('Kweebec')) return entries['family:kweebec'];
    if (key.includes('Outlander')) return entries['family:outlander'];
    return null;
  }
  function image(file) {
    if (!images.has(file)) {
      const img = new Image();
      img.decoding = 'async';
      img.src = file;
      images.set(file, img);
    }
    return images.get(file);
  }
  function render(canvas, kind, key, rarity) {
    const file = url(key, kind);
    if (!file) return false;
    const img = image(file),
      paint = () => {
        const g = canvas.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.scale(canvas.width / 32, canvas.height / 32);
        g.fillStyle = '#10212ff2';
        g.beginPath();
        g.arc(16, 16, 15, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = colors[rarity] || colors.Unclassified;
        g.lineWidth = 1.5;
        g.stroke();
        if (img.naturalWidth) {
          const scale = Math.min(25 / img.naturalWidth, 25 / img.naturalHeight),
            w = img.naturalWidth * scale,
            h = img.naturalHeight * scale;
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 16 - w / 2, 16 - h / 2, w, h);
        }
        if (typeof schedule === 'function') schedule();
      };
    paint();
    if (!img.complete) {
      img.addEventListener('load', paint, { once: true });
      img.addEventListener('error', paint, { once: true });
    }
    return true;
  }
  const ready = fetch('assets/icons/manifest.json?v=0.11.0')
    .then((r) => {
      if (!r.ok) throw Error('Icon manifest unavailable');
      return r.json();
    })
    .then((data) => {
      entries = data.entries;
      if (typeof poiSprites !== 'undefined') poiSprites.clear();
      if (typeof renderPoiPicker === 'function') renderPoiPicker();
      for (const element of document.querySelectorAll('[data-icon]')) {
        const file = entries[element.dataset.icon];
        if (file) {
          const img = document.createElement('img');
          img.src = file;
          img.alt = '';
          img.width = img.height = 20;
          element.prepend(img);
        }
      }
      if (typeof schedule === 'function') schedule();
    })
    .catch(() => {});
  return { url, render, ready, rarityColor: (rarity) => colors[rarity] || colors.Unclassified };
})();
