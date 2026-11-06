'use strict';
importScripts('engine/noise2d.js','engine/core.js');
let kernel, generation=0, queue=[], running=false;
async function getFile(path){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error('No se pudo descargar '+path+' (HTTP '+response.status+')');const data=await response.arrayBuffer();return data;}finally{clearTimeout(timeout);}}
const ready=Promise.all([getFile('engine/kernel.json').then(b=>JSON.parse(new TextDecoder().decode(b))),getFile('engine/hash64.wasm').then(b=>WebAssembly.instantiate(b))]).then(([raw,wasm])=>{kernel=new V1Kernel(raw,wasm.instance.exports);return raw;});
ready.catch(e=>postMessage({type:'error',message:'No se pudo cargar el motor. '+String(e.message||e)}));
const pause=()=>new Promise(r=>setTimeout(r,0));
async function pump(){
 if(running)return;running=true;
 try{while(queue.length){const task=queue.shift(),epoch=generation,{key,x,z,step,n}=task;const pixels=new Uint8ClampedArray(n*n*4),ids=new Uint16Array(n*n);let cancelled=false;
  for(let row=0;row<n;row++){
   for(let col=0;col<n;col++){const wx=x+col*step,wz=z+row*step,i=row*n+col;if(wx< -2147483648||wx>2147483647||wz< -2147483648||wz>2147483647)continue;
    const b=kernel.at(wx,wz),color=parseInt(b.color.slice(1),16);ids[i]=b.biomeId;pixels[i*4]=color>>>16;pixels[i*4+1]=(color>>>8)&255;pixels[i*4+2]=color&255;pixels[i*4+3]=255;}
   if(row%8===7){await pause();if(epoch!==generation){cancelled=true;break;}}
  }
  if(!cancelled)postMessage({type:'tile',generation:epoch,key,x,z,step,n,pixels,ids},[pixels.buffer,ids.buffer]);
  // Bound the point cache even during very long exploration sessions.
  if(kernel.biomeCache.size>50000)kernel.biomeCache.clear();
 }}catch(e){postMessage({type:'error',message:String(e.message||e)});}finally{running=false;}
}
onmessage=async({data})=>{try{const raw=await ready;
 if(data.type==='seed'){generation=data.generation;queue=[];kernel.setSeed(data.seed);postMessage({type:'ready',generation,biomes:raw.biomes.map(b=>({id:b.id,name:b.name,color:b.color})),version:raw.version});}
 if(data.type==='view'&&data.generation===generation){queue=data.tasks;pump();}
 if(data.type==='point'&&data.generation===generation)postMessage({type:'point',generation,request:data.request,x:data.x,z:data.z,result:kernel.at(data.x,data.z)});
}catch(e){postMessage({type:'error',message:String(e.message||e)});}};
