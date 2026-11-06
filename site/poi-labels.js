'use strict';
function structureType(path){const s=path.toLowerCase();for(const [word,key]of [['temple','temple'],['dungeon','dungeon'],['mineshaft','mine'],['shipwreck','shipwreck'],['ruin','ruins'],['village','village'],['farm','farm'],['camp','camp'],['statue','statue'],['bridge','bridge'],['portal','portal'],['tower','tower'],['house','house'],['altar','altar'],['tomb','tomb']])if(s.includes(word))return 'structure:'+key;return 'structure:other';}
const structureNames={temple:'Templos y entradas',dungeon:'Mazmorras',mine:'Minas',shipwreck:'Naufragios',ruins:'Ruinas',village:'Aldeas',farm:'Granjas',camp:'Campamentos',statue:'Estatuas',bridge:'Puentes',portal:'Portales',tower:'Torres',house:'Casas',altar:'Altares',tomb:'Tumbas',other:'Otras estructuras'};
function readableStructure(key){return structureNames[key.split(':')[1]]||'Estructura';}
function markerRank(key,kind){if(key==='unique:portal'||key==='structure:temple')return 5;if(key==='structure:dungeon'||key==='structure:portal')return 4;if(kind==='structures')return 3;if(kind==='wood')return 0;return 1;}
function markerVisible(rank,zoom){return rank===5||zoom>=([2,1.1,0.7,0.4,0.18][rank]??0.08);}
