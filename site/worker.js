'use strict';
importScripts('engine/noise2d.js','engine/core.js','engine/terrain.js','engine/fixed-spawns.js');
let kernel, generation=0, queue=[], running=false,minCoordinate=-2147483648,maxCoordinate=2147483647,fixedProfiles;
async function getFile(path){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error('No se pudo descargar '+path+' (HTTP '+response.status+')');const data=await response.arrayBuffer();return data;}finally{clearTimeout(timeout);}}
const ready=Promise.all([getFile('engine/kernel.json').then(b=>JSON.parse(new TextDecoder().decode(b))),getFile('engine/hash64.wasm').then(b=>WebAssembly.instantiate(b)),getFile('data/fixed-spawns.json').then(b=>JSON.parse(new TextDecoder().decode(b)))]).then(([raw,wasm,profiles])=>{kernel=new V1Kernel(raw,wasm.instance.exports);fixedProfiles=profiles;minCoordinate=raw.minChunkCoord*32;maxCoordinate=(raw.maxChunkCoord+1)*32-1;return raw;});
ready.catch(e=>postMessage({type:'error',message:'No se pudo cargar el motor. '+String(e.message||e)}));
const pause=()=>new Promise(r=>setTimeout(r,0));
async function pump(){
 if(running)return;running=true;
 try{while(queue.length){const task=queue.shift(),epoch=generation,{key,x,z,step,n}=task;const pixels=new Uint8ClampedArray(n*n*4),ids=new Uint16Array(n*n);let cancelled=false;
  for(let row=0;row<n;row++){
   for(let col=0;col<n;col++){const wx=x+col*step,wz=z+row*step,i=row*n+col;if(wx<minCoordinate||wx>maxCoordinate||wz<minCoordinate||wz>maxCoordinate)continue;
    const b=kernel.at(wx,wz),color=parseInt(b.color.slice(1),16);ids[i]=b.biomeId;pixels[i*4]=color>>>16;pixels[i*4+1]=(color>>>8)&255;pixels[i*4+2]=color&255;pixels[i*4+3]=255;}
   if(row%8===7){await pause();if(epoch!==generation){cancelled=true;break;}}
  }
  if(!cancelled)postMessage({type:'tile',generation:epoch,key,x,z,step,n,pixels,ids},[pixels.buffer,ids.buffer]);
  // Bound the point cache even during very long exploration sessions.
  if(kernel.biomeCache.size>50000)kernel.biomeCache.clear();
 }}catch(e){postMessage({type:'error',message:String(e.message||e)});}finally{running=false;}
}
onmessage=async({data})=>{try{const raw=await ready;
 if(data.type==='seed'){generation=data.generation;queue=[];kernel.setSeed(data.seed);const structures=kernel.uniqueStructures();postMessage({type:'ready',generation,biomes:raw.biomes.map(b=>({id:b.id,name:b.name,color:b.color})),version:raw.version,minCoordinate,maxCoordinate,structures,fixedSpawns:kernel.fixedSpawnAnchors(fixedProfiles,structures)});}
 if(data.type==='view'&&data.generation===generation){queue=data.tasks;pump();}
 if(data.type==='point'&&data.generation===generation){if(!Number.isInteger(data.x)||!Number.isInteger(data.z)||data.x<minCoordinate||data.x>maxCoordinate||data.z<minCoordinate||data.z>maxCoordinate)throw Error('Coordenadas fuera del límite del generador V1');const col=kernel.terrainColumn(data.x,data.z),environment=kernel.environmentAt(data.x,data.z);postMessage({type:'point',generation,request:data.request,x:data.x,z:data.z,result:{...kernel.at(data.x,data.z),height:col.height,environment:raw.environmentNames[String(environment)]||String(environment)}});}
}catch(e){postMessage({type:'error',message:String(e.message||e)});}};
