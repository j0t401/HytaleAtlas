'use strict';
/** The native terrain/layer/cover pass. No meshes or lighting are generated. */
class V1TerrainChunk{
 constructor(kernel,rules){this.k=kernel;this.rules=rules;this.I=typeof module!=='undefined'?require('./random.js'):globalThis.V1Integer;this.Chunk=typeof module!=='undefined'?require('./chunk-state.js'):globalThis.V1ChunkState;}
 fill(chunk){const k=this.k,rng=new this.I.FastRandom(this.I.hash(k.seed,chunk.chunkX,chunk.chunkZ,5647422603192711886n));chunk.baseHeights=new Int16Array(1024);
  for(let cx=0;cx<32;cx++)for(let cz=0;cz<32;cz++){
   const x=chunk.chunkX*32+cx,z=chunk.chunkZ*32+cz,b=k.biomes.get(k.at(x,z).biomeId),col=k.baseMaterialColumn(x,z);chunk.baseHeights[cz*32+cx]=col.height;
   for(let y=0;y<320;y++){const i=chunk.index(cx,y,cz);chunk.blocks[i]=col.blocks[y];chunk.fluids[i]=col.fluids[y];chunk.environments[i]=col.environments[y];chunk.priorities[i]=col.priorities[y];chunk.rotations[i]=col.rotations[y];chunk.fluidLevels[i]=this.rules.fluidLevels[col.fluids[y]]||0;if(col.blocks[y])chunk.allocatedSections[y>>5]=1;}
   if(!col.surfaces.length)continue;
   const parent=(cover,y,defaultBlock=0,defaultFluid=0)=>y>0&&y<320&&k.blockCondition(cover.parentCondition,chunk.getBlock(cx,y-1,cz)||defaultBlock,chunk.getFluid(cx,y-1,cz)||defaultFluid);
   const column=cover=>rng.nextDouble()<cover.coverDensity&&k.condition(cover.mapCondition,x,z);
   const height=(cover,y)=>k.heightCondition(cover.heightCondition,k.seed,x,z,y,rng);
   const paste=(cover,y)=>{const part=k.chooseRandom(cover.entries,rng),p=part.entry,py=y+part.offset;chunk.setBlock(cx,py,cz,3,p.blockId,p.rotation,0);chunk.setFluid(cx,py,cz,3,p.fluidId,this.rules.fluidLevels[p.fluidId]||0);};
   for(const water of b.water.entries)for(const cover of b.covers.entries){if(!cover.onWater||!column(cover))continue;const y=Math.floor(k.supplier(water.max,x,z))+1;if(height(cover,y)&&parent(cover,y,water.block,water.fluid))paste(cover,y);}
   for(const surface of col.surfaces){const y=surface+1;for(const cover of b.covers.entries)if(!cover.onWater&&parent(cover,y)&&column(cover)&&height(cover,y))paste(cover,y);}
  }return chunk;
 }
 generate(x,z){return this.fill(new this.Chunk(x,z));}
}
globalThis.V1TerrainChunk=V1TerrainChunk;if(typeof module!=='undefined')module.exports=V1TerrainChunk;
