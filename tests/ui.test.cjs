const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert/strict'),
  root = path.resolve(__dirname, '../site');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  elements = new Map(),
  frames = [],
  workers = [],
  labels = [],
  images = [];
const ctx = new Proxy(
  {},
  {
    get: (o, k) =>
      o[k] ||
      ((...a) => {
        if (k === 'fillText') labels.push(a[0]);
        if (k === 'drawImage') images.push(a);
      }),
    set: (o, k, v) => ((o[k] = v), true),
  },
);
function el() {
  return {
    value: '',
    checked: false,
    style: {},
    children: [],
    setAttribute(k, v) {
      this[k] = v;
    },
    append(...e) {
      this.children.push(...e);
    },
    appendChild(e) {
      this.children.push(e);
    },
    replaceChildren(...e) {
      this.children = e;
    },
    getBoundingClientRect: () => ({ width: 1100, height: 740, left: 0, top: 0 }),
    getContext: () => ctx,
    setPointerCapture() {},
  };
}
for (const x of html.matchAll(/id="([^"]+)"/g)) elements.set(x[1], el());
elements.get('seed').value = '42';
elements.get('show-structures').checked = true;
elements.get('stratum').value = 'surface';
elements.get('quality').value = '1.4';
let resize;
const s = {
  console,
  Map,
  Set,
  URLSearchParams,
  Uint32Array,
  Uint16Array,
  Uint8ClampedArray,
  ImageData: class {},
  Option: class {},
  Worker: class {
    constructor(url) {
      this.url = url;
      this.messages = [];
      workers.push(this);
    }
    postMessage(m) {
      this.messages.push(m);
    }
  },
  ResizeObserver: class {
    constructor(f) {
      resize = f;
    }
    observe() {}
  },
  document: { getElementById: (id) => elements.get(id), createElement: el },
  location: { protocol: 'http:', hash: '', href: 'http://localhost/' },
  history: { replaceState() {} },
  navigator: {},
  crypto: {},
  devicePixelRatio: 1,
  setTimeout: () => 1,
  clearTimeout() {},
  requestAnimationFrame: (f) => frames.push(f),
};
const c = vm.createContext(s);
for (const f of [
  'engine/strata.js',
  'map-gestures.js',
  'app.js',
  'integration.js',
  'poi-labels.js',
  'points-ui.js',
])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f });
resize();
vm.runInContext('initialized=true;queryPOIs()', c);
const p = workers.find((w) => w.url.startsWith('poi-worker'));
assert(p);
p.onmessage({
  data: {
    type: 'catalog',
    types: [
      { key: 'structure:temple', kind: 'structures', name: 'Templos y entradas' },
      { key: 'structure:dungeon', kind: 'structures', name: 'Mazmorras' },
      { key: 'wood:Oak', kind: 'wood', name: 'Oak Log' },
      { key: 'ore:Copper', kind: 'ore', name: 'Copper Ore' },
    ],
  },
});
elements.get('poi-labels').checked = true;
vm.runInContext(
  "poiSelected.add('wood:Oak');poiSelected.add('ore:Copper');poiPoints.set(seed+'/t',{key:'structure:temple',kind:'structures',x:0,z:0});poiPoints.set(seed+'/d',{key:'structure:dungeon',kind:'structures',x:20,z:0});poiPoints.set(seed+'/w',{key:'wood:Oak',kind:'wood',x:40,z:0});poiPoints.set(seed+'/o',{key:'ore:Copper',kind:'ore',x:60,z:0});zoom=4;drawSelectedPOIs()",
  c,
);
assert(labels.includes('Copper Ore'));
const before = workers.reduce((n, w) => n + w.messages.length, 0);
labels.length = 0;
images.length = 0;
vm.runInContext('zoom=.08;drawSelectedPOIs()', c);
assert.equal(images.length, 4, 'Every selected type remains visible at far zoom');
assert.equal(labels.length, 4, 'User can enable labels at every zoom');
elements.get('poi-labels').checked = false;
labels.length = 0;
vm.runInContext('drawSelectedPOIs()', c);
assert.equal(labels.length, 0, 'User can hide labels independently');
vm.runInContext('zoom=4;drawSelectedPOIs()', c);
assert.equal(
  workers.reduce((n, w) => n + w.messages.length, 0),
  before,
  'Zoom display changes must not regenerate stored points',
);
assert.equal(vm.runInContext('poiPoints.size', c), 4);
assert(
  [...elements.get('poi-picker').children].every((g) => !g.open && g.children.length === 1),
  'Categories start collapsed and do not build item controls',
);
const category = elements.get('poi-picker').children[0];
category.open = true;
category.ontoggle();
assert(category.children.length >= 3);
const tier = category.children[2];
tier.open = true;
tier.ontoggle();
assert(tier.children.length >= 3);
vm.runInContext('renderPoiPicker()', c);
assert(elements.get('poi-picker').children[0].open, 'Expanded state survives selection changes');
assert.equal(
  vm.runInContext("structureType('Monuments/Unique/Temple/Portal/Snowlands')", c),
  'structure:portal',
);
elements.get('poi-category').value = 'wood';
elements.get('poi-rarity').value = 'Common';
vm.runInContext('renderPoiPicker()', c);
assert.equal(elements.get('poi-picker').children.length, 1);
assert(elements.get('poi-picker').children[0].children[0].textContent.includes('Maderas'));
elements.get('poi-category').value = '';
elements.get('poi-rarity').value = '';
vm.runInContext(
  "poiPoints.clear();tiles.clear();strataCatalog={1:{name:'Env_Zone4_Lava',color:'#991100'},2:{name:'Env_Zone4_Jungle',color:'#009944'}};tiles.set('strata',{key:'strata',x:0,z:0,step:100,n:1,image:document.createElement('canvas'),pixels:new Uint8ClampedArray([255,255,255,255]),ids:new Uint16Array([1]),strataOffsets:new Uint32Array([0,4]),strataValues:new Uint16Array([0,1,40,2])});",
  c,
);
elements.get('stratum').value = 'underground';
elements.get('depth').value = '40';
const beforeLayer = workers.reduce((n, w) => n + w.messages.length, 0);
vm.runInContext('draw();requestIntegration()', c);
assert.equal(
  workers.filter((w) => w.url.startsWith('world-worker')).length,
  0,
  'Geographic underground must not start the cave/block worker',
);
assert.equal(vm.runInContext("tiles.get('strata').strataY", c), 40);
elements.get('depth').value = '20';
vm.runInContext('draw()', c);
assert.equal(vm.runInContext("tiles.get('strata').strataY", c), 20);
assert.equal(
  workers.reduce((n, w) => n + w.messages.length, 0),
  beforeLayer,
  'Layer and height must use stored strata',
);
assert.equal(
  vm.runInContext("structureType('Server/Prefabs/Npc/Kweebec/Autumn/Camps/Kweebec_Camp_001')", c),
  'structure:kweebec-camp',
);
assert.equal(
  vm.runInContext("structureType('Server/Prefabs/Dungeon/Outlander_Temple/Entrance')", c),
  'structure:outlander-temple',
);
assert.equal(vm.runInContext("poiFamily({kind:'mob',key:'mob:Hedera'})", c), 'iconic');
const report = {
  undergroundToggleUsesStoredData: true,
  noCaveWorkerForUnderground: true,
  allSelectedIconsAtFarZoom: true,
  labelsControlledByUser: true,
  categoryAndRarityFilters: true,
  categoriesCollapsedByDefault: true,
  controlsBuiltOnExpansion: true,
  portalIconUnified: true,
  visibleNames: true,
  zoomReusesPoints: true,
  individualIconButtons: true,
  visualBrowserInspection: false,
};
console.log(report);

let oreProjections = 0;
s.projectOrePoint = (point) => {
  oreProjections++;
  return point;
};
vm.runInContext(
  "paintPOI({key:'ore:Copper',kind:'ore',x:2140000000,z:2140000000,y:50,heightCounts:{50:1}})",
  c,
);
assert.equal(oreProjections, 0, 'Offscreen ores skip their expensive height projection');
const beforeDragRequests = workers.reduce((n, w) => n + w.messages.length, 0);
vm.runInContext('for(let i=0;i<100;i++)requestViewSoon()', c);
assert.equal(
  workers.reduce((n, w) => n + w.messages.length, 0),
  beforeDragRequests,
  'Camera motion renders immediately without posting worker views on every event',
);
console.log({ offscreenOreProjectionSkipped: true, cameraEventsDoNotFloodWorkers: true });
