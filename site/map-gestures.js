'use strict';
/** Pointer gestures in CSS pixels. A pinch cannot turn into a tap after one finger lifts. */
class AtlasMapGestures {
  constructor(options) {
    this.options = options;
    this.points = new Map();
    this.start = null;
    this.blockTap = false;
  }
  down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!this.points.size) {
      this.start = { x: e.clientX, y: e.clientY };
      this.blockTap = false;
    }
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.points.size > 1) this.blockTap = true;
    this.rebase();
  }
  rebase() {
    const p = [...this.points.values()];
    if (!p.length) return;
    const center = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    this.base = {
      ...this.options.view(),
      center,
      distance: p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0,
    };
  }
  move(e) {
    if (!this.points.has(e.pointerId)) return false;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 6) this.blockTap = true;
    const p = [...this.points.values()],
      b = this.base,
      v = this.options.view();
    const center = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    const z =
      p.length > 1 && b.distance > 0
        ? Math.max(
            0.08,
            Math.min(32, (b.zoom * Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)) / b.distance),
          )
        : b.zoom;
    this.options.change({
      zoom: z,
      x: b.x + (b.center.x - v.left - v.width / 2) / b.zoom - (center.x - v.left - v.width / 2) / z,
      z: b.z + (b.center.y - v.top - v.height / 2) / b.zoom - (center.y - v.top - v.height / 2) / z,
    });
    return true;
  }
  up(e, cancel = false) {
    if (!this.points.has(e.pointerId)) return;
    if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 6) this.blockTap = true;
    this.points.delete(e.pointerId);
    if (cancel) this.blockTap = true;
    if (this.points.size) {
      this.rebase();
      return;
    }
    if (!cancel && !this.blockTap) this.options.tap(e);
    this.options.commit();
  }
}
if (typeof module !== 'undefined') module.exports = AtlasMapGestures;
