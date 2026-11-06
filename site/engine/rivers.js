'use strict';
/** Open river water relative to the verified base terrain, before caves/prefabs/covers. */
function installV1Rivers(Kernel){
 Kernel.prototype.riverSurface=function(x,z,biomeId){
  const biome=this.biomes.get(biomeId??this.at(x,z).biomeId);if(!/^River(?:_|$)/.test(biome.name))return null;
  let level=-2147483648,fluid=0;
  for(const entry of biome.water.entries){if(entry.fluid===0||!this.condition(entry.mask,x,z))continue;const lo=Math.floor(this.supplier(entry.min,x,z)),hi=Math.floor(this.supplier(entry.max,x,z));if(lo<=hi&&hi>level){level=hi;fluid=entry.fluid;}}
  if(level<0)return null;const height=this.terrainColumn(x,z).height;return level>height?{level,height,fluid}:null;
 };
}
if(typeof module!=='undefined')module.exports=installV1Rivers;else installV1Rivers(globalThis.V1Kernel);
