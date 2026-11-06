const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const elements = new Map();
function element() {
  return {
    value: '',
    checked: false,
    hidden: false,
    options: [{}],
    style: { setProperty() {} },
    children: [],
    setAttribute() {},
    setCustomValidity() {},
    focus() {},
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener() {},
    oninput() {},
    onsubmit() {},
  };
}
const get = (id) => {
  if (!elements.has(id)) elements.set(id, element());
  return elements.get(id);
};
let generationRequests = 0,
  draws = 0;
const body = {
  classList: {
    toggle() {},
    add() {},
    remove() {},
    contains() {
      return false;
    },
  },
};
const s = {
  $: get,
  console,
  Map,
  Set,
  Math,
  Number,
  Boolean,
  performance,
  document: { getElementById: get, createElement: element, body, addEventListener() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  canvas: element(),
  requestAnimationFrame: (f) => f(),
  schedule: () => draws++,
  requestView: () => generationRequests++,
  queueIntegration: () => generationRequests++,
  setTimeout,
  clearTimeout,
  navigator: {},
  poiTypes: new Map(),
  poiPoints: new Map(),
  poiSelected: new Set(),
  poiDataRevision: 0,
  poiCatalogReady: false,
  poiHitTargets: [],
  seed: '12345',
  zoom: 0.18,
  cx: 0,
  cz: 0,
  w: 1000,
  h: 700,
  selectedRarity: () => 'Rare',
  poiKey: (p) => p.key,
  clamp: (x) => x,
};
const c = vm.createContext(s),
  site = path.resolve(__dirname, '../site');
vm.runInContext(fs.readFileSync(path.join(site, 'poi-labels.js'), 'utf8'), c);
vm.runInContext(fs.readFileSync(path.join(site, 'ui.js'), 'utf8'), c);
get('stratum').value = 'surface';
get('depth').value = '50';
get('ore-y-enabled').checked = true;
get('ore-y-min').value = '50';
get('ore-y-max').value = '50';
s.sample = {
  key: 'ore:Thorium',
  kind: 'ore',
  source: 'final-blocks',
  confirmed: true,
  x: 7,
  y: 20,
  z: 9,
  minY: 20,
  maxY: 50,
  count: 5,
  heightCounts: { 20: 2, 50: 3 },
  levelPositions: { 20: [7, 9], 50: [11, 14] },
};
const point = vm.runInContext('projectOrePoint(sample)', c);
assert.equal(point.y, 50);
assert.equal(point.x, 11);
assert.equal(point.z, 14);
assert.equal(point.count, 3);
get('ore-y-min').value = '30';
get('ore-y-max').value = '40';
assert.equal(
  vm.runInContext('projectOrePoint(sample)', c),
  null,
  'A gap between occupied heights is not an ore location',
);
get('ore-y-min').oninput();
assert.equal(generationRequests, 0, 'Height filters only redraw stored data');
assert(draws > 0);
get('ore-y-enabled').checked = false;
get('stratum').value = 'underground';
get('depth').value = '50';
assert.equal(vm.runInContext('projectOrePoint(sample).y', c), 50);
get('depth').value = '40';
assert.equal(vm.runInContext('projectOrePoint(sample)', c), null);
get('stratum').value = 'surface';
get('poi-cluster').checked = true;
s.clusterSamples = [
  {
    key: 'ore:Thorium',
    kind: 'ore',
    source: 'ore-deposit',
    x: 10,
    y: 50,
    z: 10,
    minY: 45,
    maxY: 55,
  },
  {
    key: 'ore:Thorium',
    kind: 'ore',
    source: 'ore-deposit',
    x: 12,
    y: 51,
    z: 11,
    minY: 48,
    maxY: 56,
  },
];
const cluster = vm.runInContext('prepareMapPoints(clusterSamples)', c);
assert.equal(cluster.length, 1);
assert.equal(cluster[0].clusterPoints.length, 2);
get('poi-cluster').checked = false;
assert.equal(
  vm.runInContext('prepareMapPoints(clusterSamples).length', c),
  2,
  'All individual deposits remain available at the same zoom',
);
assert.equal(generationRequests, 0);
console.log({
  exactHeightCoordinateProjection: true,
  emptyHeightBandsHidden: true,
  heightFilteringDoesNotRegenerate: true,
  optionalGroupingRetainsAllPoints: true,
  errors: 0,
});
