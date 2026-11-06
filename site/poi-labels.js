'use strict';
function hasRegionalStructure(path) {
  return /Monuments|Dungeon|Temple|Mineshaft|Klops|Treasure|Scarak|Npc\/(?:Kweebec|Outlander|Trork|Feran|Goblin)/i.test(
    path,
  );
}
function structureType(path) {
  const s = path.toLowerCase();
  if (/portal/.test(s)) return 'structure:portal';
  if (s.includes('kweebec'))
    return (
      'structure:kweebec' + (s.includes('camp') ? '-camp' : s.includes('garden') ? '-garden' : '')
    );
  if (s.includes('outlander'))
    return (
      'structure:outlander' + (s.includes('temple') ? '-temple' : s.includes('camp') ? '-camp' : '')
    );
  for (const [word, key] of [
    ['temple', 'temple'],
    ['dungeon', 'dungeon'],
    ['mineshaft', 'mine'],
    ['shipwreck', 'shipwreck'],
    ['ruin', 'ruins'],
    ['village', 'village'],
    ['farm', 'farm'],
    ['camp', 'camp'],
    ['statue', 'statue'],
    ['bridge', 'bridge'],
    ['tower', 'tower'],
    ['house', 'house'],
    ['altar', 'altar'],
    ['tomb', 'tomb'],
  ])
    if (s.includes(word)) return 'structure:' + key;
  return 'structure:other';
}
const structureNames = {
  kweebec: 'Asentamientos Kweebec',
  'kweebec-camp': 'Campamentos Kweebec',
  'kweebec-garden': 'Huertos Kweebec',
  outlander: 'Asentamientos Outlander',
  'outlander-temple': 'Templos Outlander',
  'outlander-camp': 'Campamentos Outlander',
  temple: 'Templos y entradas',
  dungeon: 'Mazmorras',
  mine: 'Minas',
  shipwreck: 'Naufragios',
  ruins: 'Ruinas',
  village: 'Aldeas',
  farm: 'Granjas',
  camp: 'Campamentos',
  statue: 'Estatuas',
  bridge: 'Puentes',
  portal: 'Templos de portal',
  tower: 'Torres',
  house: 'Casas',
  altar: 'Altares',
  tomb: 'Tumbas',
  other: 'Otras estructuras',
};
function readableStructure(key) {
  return structureNames[key.split(':')[1]] || 'Estructura';
}
function markerRank(key, kind) {
  if (key === 'unique:portal' || key === 'structure:portal') return 5;
  if (key === 'structure:temple' || key === 'structure:dungeon') return 4;
  if (kind === 'structures') return 3;
  return 1;
}
const poiRarityNames = {
  Common: 'Común',
  Uncommon: 'Poco común',
  Rare: 'Rara',
  Epic: 'Épica',
  Legendary: 'Legendaria',
  Unclassified: 'Sin clasificar',
};
function atlasRarity(t) {
  if (t.raritySource === 'game' && poiRarityNames[t.rarity]) return t.rarity;
  if (t.key === 'structure:portal') return 'Legendary';
  if (t.kind === 'structures') return /temple|dungeon/.test(t.key) ? 'Epic' : 'Uncommon';
  if (t.kind === 'chest') return 'Uncommon';
  if (t.kind === 'mob')
    return /Dragon/.test(t.key)
      ? 'Legendary'
      : /Golem|Boss|Broodmother|Hedera|Yeti/.test(t.key)
        ? 'Epic'
        : 'Common';
  if (t.kind === 'wood')
    return /Goldenwood|Amber|Wisteria|Crystal|Spiral|Stormbark|Fire$/.test(t.key)
      ? 'Rare'
      : /Ice|Azure|Poisoned|Petrified/.test(t.key)
        ? 'Uncommon'
        : 'Common';
  if (t.kind === 'ore')
    return /Mithril/.test(t.key)
      ? 'Legendary'
      : /Adamantite/.test(t.key)
        ? 'Epic'
        : /Gold|Thorium|Cobalt|Silver/.test(t.key)
          ? 'Rare'
          : 'Common';
  return 'Unclassified';
}
function poiFamily(t) {
  if (t.kind === 'structures' && t.key.startsWith('structure:kweebec')) return 'kweebec';
  if (t.kind === 'structures' && t.key.startsWith('structure:outlander')) return 'outlander';
  if (t.kind === 'mob' && /Golem/.test(t.key)) return 'golems';
  if (t.kind === 'mob' && /Dragon|Boss|Hedera|Yeti|Rex|Broodmother|Feastmaster|Wraith/.test(t.key))
    return 'iconic';
  return t.kind;
}
const poiFamilyNames = {
  structures: 'Estructuras',
  kweebec: 'Kweebec',
  outlander: 'Outlanders',
  iconic: 'Mobs destacados',
  golems: 'Gólems',
  mob: 'Otros mobs fijos',
  wood: 'Maderas',
  ore: 'Minerales',
  chest: 'Cofres y contenedores',
};
