const assert = require('node:assert/strict');
const Gestures = require('../site/map-gestures.js');
let view = { x: 100, z: -80, zoom: 2, left: 200, top: 60, width: 800, height: 600 },
  taps = 0,
  commits = 0;
const g = new Gestures({
  view: () => view,
  change: (v) => Object.assign(view, v),
  tap: () => taps++,
  commit: () => commits++,
});
const p = (pointerId, clientX, clientY) => ({ pointerId, clientX, clientY, button: 0 });
g.down(p(1, 500, 360));
g.down(p(2, 700, 360));
g.move(p(1, 400, 360));
g.move(p(2, 800, 360));
assert.equal(view.zoom, 4);
assert.equal(view.x, 100);
assert.equal(view.z, -80);
// Translating both fingers pans while retaining the world point below the midpoint.
g.move(p(1, 440, 400));
g.move(p(2, 840, 400));
assert.equal(view.zoom, 4);
assert.equal(view.x, 90);
assert.equal(view.z, -90);
g.up(p(1, 440, 400));
const before = view.x;
g.move(p(2, 860, 400));
assert.equal(view.x, before - 5);
g.up(p(2, 860, 400));
assert.equal(taps, 0);
g.down(p(1, 500, 360));
g.move(p(1, 530, 360));
g.move(p(1, 500, 360));
g.up(p(1, 500, 360));
assert.equal(taps, 0, 'Dragging back to the origin is not a tap');
g.down(p(1, 500, 360));
g.up(p(1, 500, 360));
assert.equal(taps, 1);
g.down(p(1, 500, 360));
g.up(p(1, 500, 360), true);
assert.equal(taps, 1);
view.zoom = 31;
g.down(p(1, 500, 360));
g.down(p(2, 700, 360));
g.move(p(2, 1200, 360));
assert.equal(view.zoom, 32);
g.up(p(1, 500, 360));
g.up(p(2, 1200, 360));
console.log({
  pinchAnchorPreserved: true,
  panAfterPinchContinuous: true,
  noFalsePinAfterDragOrCancel: true,
  zoomLimitRespected: true,
  errors: 0,
});
