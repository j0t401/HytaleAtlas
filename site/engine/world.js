'use strict';
class V1World{
 constructor(k,terrain,caves,surface,paste,geometry,rules){Object.assign(this,{k,terrain,caves,surface,paste,geometry,rules});this.I=caves.I;}
 intersects(c,chunk,extended=true){const b=this.surface.rotated(this.geometry[this.paste.data.canonical(c.path||c.prefabPath)][extended?'boundsWithChildren':'bounds'],c.rotation);return c.x+b[3]>=chunk.chunkX*32&&c.x+b[0]<=chunk.chunkX*32+31&&c.z+b[5]>=chunk.chunkZ*32&&c.z+b[2]<=chunk.chunkZ*32+31;}
 async structures(chunk){const {candidates,uniques}=this.surface.collect(chunk.chunkX,chunk.chunkZ);chunk.structures??=[];
  for(const c of candidates){if(c.invalidated||!this.intersects(c,chunk))continue;const p=c.pattern;await this.place(c,chunk,p.prefabPlacementConfiguration,c.entry.environmentId,p.fitHeightmap,p.submerge,p.heightCondition);chunk.structures.push({x:c.x,y:c.y,z:c.z,path:c.path,rotation:c.rotation});}
  for(const u of uniques){if(!this.intersects(u,chunk))continue;const c=u.config;await this.place(u,chunk,c.placementConfiguration,c.environmentId,c.fitHeightmap,c.submerge,{type:'DefaultCoordinateRndCondition',result:true});chunk.structures.push({...u,path:u.prefabPath});}
  return chunk;
 }
 async place(c,chunk,mask,environment,fitHeightmap,submerge,condition){const k=this.k;await this.paste.generate(c.path||c.prefabPath,{chunk,seed:k.seed,externalSeed:this.I.signed(this.I.hash(c.x,c.z)*-1058827062n),x:c.x,y:c.y,z:c.z,rotation:Number(c.rotation.split('_')[1])/90,blockMask:mask,environment,fitHeightmap,priority:submerge?41:9,height:(x,z)=>k.terrainColumn(x,z).height,spawnCondition:(seed,x,z,y,rng)=>k.heightCondition(condition,seed,x,z,y,rng)});}
 water(chunk){const k=this.k;chunk.caveModifier=false;for(let cx=0;cx<32;cx++)for(let cz=0;cz<32;cz++){const x=chunk.chunkX*32+cx,z=chunk.chunkZ*32+cz,b=k.biomes.get(k.at(x,z).biomeId);for(const e of b.water.entries){if(!k.condition(e.mask,x,z))continue;const min=Math.floor(k.supplier(e.min,x,z)),max=Math.floor(k.supplier(e.max,x,z));for(let y=Math.max(0,min);y<=Math.min(319,max);y++){const i=chunk.index(cx,y,cz),raw=chunk.priorities[i],p=raw&31;if(p>=4&&!(raw&32))continue;let block=chunk.blocks[i];if(e.block&&p<4){chunk.setBlock(cx,y,cz,-1,e.block);block=e.block;}const rule=this.rules.blocks[block];if(!rule||rule.solid)continue;chunk.setFluid(cx,y,cz,-1,e.fluid,this.rules.fluidLevels[e.fluid]||0);}}}return chunk;}
 async generate(x,z){const chunk=this.terrain.generate(x,z);await this.caves.populate(chunk);await this.structures(chunk);this.water(chunk);return chunk;}
}
globalThis.V1World=V1World;if(typeof module!=='undefined')module.exports=V1World;
