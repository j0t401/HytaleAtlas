'use strict';
importScripts('engine/noise2d.js','engine/core.js','engine/terrain.js','engine/materials.js','engine/compiled-noise.js','engine/strata.js','engine/fixed-spawns.js','engine/graph-data.js','engine/rivers.js');
let kernel,strata,detailKernel,detailRaw,detailPromise,fixedProfiles,generation=0,queue=[],running=false,active=null,wanted=new Map(),minCoordinate=-2147483648,maxCoordinate=2147483647;
const colors=new Map(),riverIds=new Set(),tileData=new Map(),pause=()=>new Promise(r=>setTimeout(r,0));
async function getFile(path){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);try{const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error('No se pudo descargar '+path+' (HTTP '+response.status+')');return await response.arrayBuffer();}finally{clearTimeout(timeout);}}
const ready=Promise.all([V1GraphData.load('engine/map-kernel.json',getFile),getFile('engine/hash64.wasm').then(b=>WebAssembly.instantiate(b)),(typeof DecompressionStream==='undefined'?getFile('engine/strata.json'):getFile('engine/strata.json.gz').then(b=>new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())).then(b=>JSON.parse(new TextDecoder().decode(b)))]).then(([raw,wasm,strataRaw])=>{kernel=new V1Kernel(raw,wasm.instance.exports);strata=new V1Strata(kernel,strataRaw);minCoordinate=raw.minChunkCoord*32;maxCoordinate=(raw.maxChunkCoord+1)*32-1;for(const b of raw.biomes){colors.set(b.id,parseInt(b.color.slice(1),16));if(/^River(?:_|$)/.test(b.name))riverIds.add(b.id);}return{raw,hash:wasm.instance.exports};});
ready.catch(e=>postMessage({type:'error',message:'No se pudo cargar el motor. '+String(e.message||e)}));
function metadata(type,raw,extra={}){const zones=new Map();for(const z of kernel.data.zones)for(const id of [...z.tiles.weighted.map(e=>e[0].$biome),...z.custom.map(e=>e.$biome)]){const name=/Zone(\d)/.exec(z.name)?.[1];if(!zones.has(id))zones.set(id,new Set());zones.get(id).add(name?'Zona '+name:'Océanos');}postMessage({type,generation,biomes:raw.biomes.map(b=>({id:b.id,name:b.name,color:b.color,zones:[...(zones.get(b.id)||[])]})),version:raw.version,minCoordinate,maxCoordinate,environments:strata.catalog,...extra});}
function publishDetails(){detailKernel.seed=kernel.seed;detailKernel.unique=kernel.unique;detailKernel.biomeCache=kernel.biomeCache;detailKernel.terrainCache?.clear();const structures=detailKernel.uniqueStructures();metadata('details',detailRaw,{structures,fixedSpawns:detailKernel.fixedSpawnAnchors(fixedProfiles,structures)});}
function details(){if(!detailPromise)detailPromise=Promise.all([ready,V1GraphData.load('engine/kernel.json',getFile),getFile('data/fixed-spawns.json')]).then(([base,raw,profiles])=>{detailRaw=raw;fixedProfiles=JSON.parse(new TextDecoder().decode(profiles));detailKernel=new V1Kernel(raw,base.hash);publishDetails();return detailKernel;}).catch(e=>{detailPromise=null;postMessage({type:'error',generation,message:'No se pudo cargar el detalle: '+e.message});throw e;});return detailPromise;}

let tileSeed='';const tileDisk=typeof indexedDB==='undefined'?Promise.resolve(null):new Promise(resolve=>{const r=indexedDB.open('atlas-biome-tiles-v08',1);r.onupgradeneeded=()=>r.result.createObjectStore('tiles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
async function readTile(key){const db=await tileDisk;if(!db)return null;return new Promise(resolve=>{try{const r=db.transaction('tiles').objectStore('tiles').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);}catch{resolve(null);}});}
async function saveTile(key,value){const db=await tileDisk;if(!db)return;try{const t=db.transaction('tiles','readwrite');t.objectStore('tiles').put(value,key);t.onerror=e=>e.preventDefault();}catch{}}
async function render(task,preview){
 const epoch=generation,factor=preview?4:1,n=Math.ceil(task.n/factor),step=task.step*factor,{key,x,z}=task,pixels=new Uint8ClampedArray(n*n*4),ids=new Uint16Array(n*n),water=new Uint8Array(n*n),strataOffsets=new Uint32Array(n*n+1),strataRuns=[],strataColumn=new Uint16Array(320);
 const obsolete=()=>epoch!==generation||!wanted.has(key);const diskKey='strata-v2/'+tileSeed+'/'+key;if(task.restored&&!preview)return;const saved=await readTile(diskKey);if(obsolete())return;if(saved){task.restored=true;postMessage({...saved,generation:epoch,preview:false,waterPending:false});return;}
 let start=performance.now();
 for(let row=0;row<n;row++){
  for(let col=0;col<n;col++){const wx=x+col*step,wz=z+row*step,i=row*n+col;strataOffsets[i]=strataRuns.length;if(wx<minCoordinate||wx>maxCoordinate||wz<minCoordinate||wz>maxCoordinate)continue;
   const b=kernel.at(wx,wz),color=colors.get(b.biomeId);ids[i]=b.biomeId;pixels[i*4]=color>>>16;pixels[i*4+1]=(color>>>8)&255;pixels[i*4+2]=color&255;pixels[i*4+3]=255;strataRuns.push(...strata.bands(wx,wz,b.biomeId,strataColumn));
  }
  if(performance.now()-start>12){await pause();if(obsolete())return;start=performance.now();}
 }
 strataOffsets[n*n]=strataRuns.length;const strataValues=new Uint16Array(strataRuns);
 if(!obsolete()){if(!preview){saveTile(diskKey,{type:'tile',key,x,z,step,n,pixels,ids,water,strataOffsets,strataValues});tileData.delete(key);tileData.set(key,{ids});while(tileData.size>180)tileData.delete(tileData.keys().next().value);}postMessage({type:'tile',generation:epoch,key,x,z,step,n,preview,waterPending:false,pixels,ids,water,strataOffsets,strataValues});}
}
async function renderWater(task){
 const epoch=generation,{key,x,z,step,n}=task,obsolete=()=>epoch!==generation||!wanted.has(key);await details();if(obsolete())return;
 if(!tileData.has(key)){await render(task,false);if(obsolete())return;}
 const ids=tileData.get(key).ids,water=new Uint8Array(n*n);let start=performance.now(),published=start;
 for(let i=0;i<ids.length;i++){
  if(riverIds.has(ids[i])){const wx=x+i%n*step,wz=z+Math.floor(i/n)*step;if(wx>=minCoordinate&&wx<=maxCoordinate&&wz>=minCoordinate&&wz<=maxCoordinate&&detailKernel.riverSurface(wx,wz,ids[i]))water[i]=1;}
  if(performance.now()-start>12){if(performance.now()-published>80){postMessage({type:'water',generation:epoch,key,water,waterPending:true});published=performance.now();}await pause();if(obsolete())return;start=performance.now();}
 }
 if(!obsolete())postMessage({type:'water',generation:epoch,key,water,waterPending:false});
}
async function pump(){if(running)return;running=true;try{while(queue.length){active=queue.shift();if(wanted.has(active.task.key)){if(active.stage===2)await renderWater(active.task);else await render(active.task,active.stage===0);}active=null;}}catch(e){postMessage({type:'error',generation,message:String(e.message||e)});}finally{running=false;active=null;}}
onmessage=async({data})=>{try{const {raw}=await ready;
 if(data.type==='seed'){generation=data.generation;tileSeed='0.8.0/'+raw.version+'/'+strata.datasetId+'/'+data.seed;queue=[];wanted.clear();tileData.clear();kernel.setSeed(data.seed);metadata('ready',raw);if(detailKernel)publishDetails();else details().catch(()=>{});}
 if(data.type==='view'&&data.generation===generation){wanted=new Map(data.tasks.map(t=>[t.key,t]));const jobs=[];for(const stage of [0,1])for(const task of data.tasks){if(stage===0&&task.hasPreview||stage===1&&task.hasBiomes)continue;if(active?.generation===generation&&active.task.key===task.key&&active.stage===stage)continue;jobs.push({task,stage,generation});}queue=jobs;pump();}
 if(data.type==='point'&&data.generation===generation){const epoch=generation,k=await details();if(epoch!==generation)return;if(!Number.isInteger(data.x)||!Number.isInteger(data.z)||data.x<minCoordinate||data.x>maxCoordinate||data.z<minCoordinate||data.z>maxCoordinate)throw Error('Coordenadas fuera del límite del generador V1');const col=k.terrainColumn(data.x,data.z),environment=k.environmentAt(data.x,data.z);postMessage({type:'point',generation,request:data.request,x:data.x,z:data.z,result:{...kernel.at(data.x,data.z),height:col.height,environment:detailRaw.environmentNames[String(environment)]||String(environment)}});}
}catch(e){postMessage({type:'error',generation,message:String(e.message||e)});}};
