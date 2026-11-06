'use strict';
/** Native buffer iteration only. Terrain masks, priorities and child placement follow separately. */
class V1PrefabIterator{
 constructor(data,transforms){this.data=data;this.transforms=transforms;}
 xz(x,z,rotation){switch(rotation){case 0:return[x,z];case 1:return[z,-x];case 2:return[-x,-z];case 3:return[-z,x];default:throw Error('Invalid prefab rotation');}}
 forEach(prefab,{random,rotation=0,column=()=>true,block=()=>{},child=()=>{}}){
  const rt=this.transforms.rotations[rotation];if(!rt)throw Error('Missing prefab rotation table');
  for(const [cx,cz,start,count]of prefab.meta.columns){
   const [x,z]=this.xz(cx,cz,rotation);if(!column(x,z,count))continue;
   for(let i=start;i<start+count;i++){
    const b=this.data.block(prefab,i);if((b.mask&4)!==0&&b.chance<random.nextFloat())continue;
    const filler=this.transforms.fillers[b.filler],rot=rt[b.rotation];
    if(!filler||rot===undefined)throw Error('Missing prefab block transform');
    block({...b,x,z,rotation:rot,filler:filler[rotation],fluidLevel:b.fluidLevel<<24>>24});
   }
  }
  for(const c of prefab.meta.children){const [x,z]=this.xz(c.x,c.z,rotation);child({...c,x,z});}
 }
}
globalThis.V1PrefabIterator=V1PrefabIterator;if(typeof module!=='undefined')module.exports=V1PrefabIterator;
