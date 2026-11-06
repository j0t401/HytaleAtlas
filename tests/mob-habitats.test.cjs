const fs = require('node:fs'),
  zlib = require('node:zlib'),
  assert = require('node:assert/strict');
const Habitats = require('../site/mob-habitats.js');
const profile = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(require.resolve('../site/data/mob-spawns.json.gz'))),
);
const index = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(require.resolve('../site/data/poi-contents.json.gz'))),
);
const rules = JSON.parse(fs.readFileSync(require.resolve('../site/data/world-rules.json')));
const bear = profile.mobs['mob:Bear_Grizzly'];
assert.equal(bear.fixedPrefabCount, 0);
assert.equal(bear.spawnMode, 'habitat');
assert(bear.available);
assert(
  bear.habitats.some(
    (h) =>
      h.environments.includes('Env_Zone1_Forests') &&
      h.DayTimeRange[0] === 6 &&
      h.DayTimeRange[1] === 18,
  ),
);
const layer = new Habitats((offsets, values, i) => values[i]);
layer.select([bear]);
const env = bear.habitatEnvironments[0];
const tile = {
  x: 100,
  z: 200,
  n: 2,
  step: 16,
  surfaceEnvironments: new Uint16Array([env, 65000, 65000, env]),
  strataOffsets: [0, 1, 2, 3, 4],
  strataValues: [65000, env, 65000, 65000],
};
const first = layer.sample(tile);
assert(first.points.length);
assert(first.points.every((p) => p.source === 'habitat' && !p.confirmed && p.y === null));
assert.equal(first.pixels[7], 0, 'Incompatible environment must not be painted');
assert.equal(first.pixels[3], 48);
assert.equal(layer.sample(tile), first, 'Camera movement reuses mask and guide positions');
const underground = layer.sample(tile, 40);
assert.equal(underground.points[0].x, 116);
assert.equal(underground.points[0].z, 200);
assert.equal(underground.points[0].y, 40);
layer.select([]);
assert.equal(layer.sample(tile), null, 'Deselected habitats disappear without regeneration');
let mapped = 0;
for (const [key, mob] of Object.entries(profile.mobs)) {
  assert.equal(index.types[key].available, mob.available, key);
  if (!mob.habitatEnvironments.length) continue;
  mapped++;
  layer.select([mob]);
  const sample = layer.sample({
    ...tile,
    surfaceEnvironments: new Uint16Array(4).fill(mob.habitatEnvironments[0]),
  });
  assert(
    sample.points.some((p) => p.key === key),
    key + ' must have a visible guide in a compatible environment',
  );
}
assert.equal(mapped, 176);
const markerKeys = new Set();
for (const prefab of Object.values(index.prefabs))
  for (const p of prefab.points) if (p.kind === 'mob') markerKeys.add(p.key);
for (const [key, mob] of Object.entries(profile.mobs))
  if (mob.fixedPrefabCount || mob.possiblePrefabCount)
    assert(markerKeys.has(key), key + ' has referenced prefab markers but no indexed point');
for (const rule of rules.catalog.markerRules)
  for (const choice of rule.choices)
    if (choice.mob && choice.relativeWeight > 0) assert(profile.mobs['mob:' + choice.mob]);
console.log({
  grizzlyHabitatVisible: true,
  habitatSpeciesCovered: mapped,
  allPositiveMarkerChoicesAudited: true,
  habitatsNotIndividualSpawns: true,
  cachedMasksReused: true,
  undergroundHabitatFromCachedBands: true,
  errors: 0,
});
