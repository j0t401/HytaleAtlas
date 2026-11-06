'use strict';
/** Bounded, seed-independent cache of compact numerical prefab data. */
class V1PrefabData{
 constructor(manifest,{base='data/native-prefabs/',fetchFile,maxBytes=32*1024*1024}={}){
  if(manifest.format!==2||manifest.recordBytes!==44)throw Error('Unsupported numerical prefab format');
  this.manifest=manifest;this.base=base;this.maxBytes=maxBytes;this.cache=new Map();this.pending=new Map();this.bytes=0;
  this.fetchFile=fetchFile||(async(path,kind)=>{const r=await fetch(path);if(!r.ok)throw Error('Could not load prefab data (HTTP '+r.status+')');return kind==='json'?r.json():new Uint8Array(await r.arrayBuffer());});
 }
 canonical(path){return path.replace(/\.(?:prefab\.json|lpf)$/,'');}
 async load(path){
  path=this.canonical(path);if(this.cache.has(path)){const value=this.cache.get(path);this.cache.delete(path);this.cache.set(path,value);return value;}
  if(this.pending.has(path))return this.pending.get(path);
  const job=this.read(path);this.pending.set(path,job);
  try{return await job;}finally{this.pending.delete(path);}
 }
 async read(path){
  const record=this.manifest.prefabs[path];if(!record)throw Error('Missing numerical prefab '+path);
  const [meta,compressed]=await Promise.all([this.fetchFile(this.base+record.data+'.json','json'),this.fetchFile(this.base+record.data+'.binz','binary')]);
  if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decompress map layer data');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')),buffer=await new Response(stream).arrayBuffer();
  if(buffer.byteLength!==meta.blockCount*44)throw Error('Invalid numerical prefab block count');
  let total=0;for(const [x,z,start,count]of meta.columns){if(start!==total||count<0)throw Error('Invalid prefab column order');total+=count;}
  if(total!==meta.blockCount)throw Error('Incomplete prefab columns');
  const view=new DataView(buffer),size=buffer.byteLength+JSON.stringify(meta).length*2,value={path,meta,view,bytes:size};
  if(size<=this.maxBytes){this.cache.set(path,value);this.bytes+=size;while(this.bytes>this.maxBytes&&this.cache.size){const key=this.cache.keys().next().value,old=this.cache.get(key);this.bytes-=old.bytes;this.cache.delete(key);}}
  return value;
 }
 block(data,index){const b=index*44,v=data.view;if(index<0||index>=data.meta.blockCount)throw Error('Invalid prefab record index');return{x:v.getInt32(b,true),y:v.getInt32(b+4,true),z:v.getInt32(b+8,true),block:v.getInt32(b+12,true),mask:v.getInt32(b+16,true),chance:v.getFloat32(b+20,true),support:v.getInt32(b+24,true),rotation:v.getInt32(b+28,true),filler:v.getInt32(b+32,true),fluid:v.getInt32(b+36,true),fluidLevel:v.getInt32(b+40,true)};}
 clear(){this.cache.clear();this.bytes=0;}
}
globalThis.V1PrefabData=V1PrefabData;if(typeof module!=='undefined')module.exports=V1PrefabData;
