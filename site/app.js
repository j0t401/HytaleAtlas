'use strict';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
const fileMode=location.protocol==='file:';
let worker,workerFailed=false;
try{worker=fileMode?{postMessage(){}}:new Worker('worker.js?v=0.4.1');}catch(e){workerFailed=true;worker={postMessage(){}};$('status').textContent='No se pudo iniciar el motor: '+e.message;}
if(fileMode){const notice=document.createElement('div');notice.className='startup-notice';notice.innerHTML='<strong>Abre el Atlas con su lanzador</strong><p>Este archivo se abrió directamente desde una carpeta. Para cargar el motor, abre <b>Iniciar Atlas.cmd</b> y mantén su ventana abierta.</p><a href="http://127.0.0.1:8766/">Abrir la dirección local del Atlas →</a>'; $('map').appendChild(notice);$('status').textContent='Hace falta abrir la dirección HTTP local';$('progress').textContent='Abre Iniciar Atlas.cmd';}
const MIN=-2147483648,MAX=2147483647,N=64,LIMIT=180;
let cx=0,cz=0,zoom=.18,w=0,h=0,epoch=0,initialized=false,seed='12345',tiles=new Map(),catalog=new Map(),visible=[],drawQueued=false,pointer=null,hover=0,hoverTimer,viewTimer;
const clamp=v=>Math.max(MIN,Math.min(MAX,v)),pretty=s=>s.replaceAll('_',' ');
const url=new URLSearchParams(location.hash.slice(1));
if(url.has('seed'))$('seed').value=url.get('seed');
if(Number.isFinite(Number(url.get('x'))))cx=clamp(Number(url.get('x')));
if(Number.isFinite(Number(url.get('z'))))cz=clamp(Number(url.get('z')));
if(url.has('zoom')&&Number.isFinite(Number(url.get('zoom'))))zoom=Math.max(2**-24,Math.min(32,Number(url.get('zoom'))));
function world(px,py){return{x:clamp(Math.floor(cx+(px-w/2)/zoom)),z:clamp(Math.floor(cz+(py-h/2)/zoom))};}
function plan(){const step=2**Math.max(0,Math.ceil(Math.log2(1/(zoom*.7)))),span=N*step,left=cx-w/2/zoom,top=cz-h/2/zoom,result=[];
 for(let tz=Math.floor(Math.max(MIN,top)/span);tz<=Math.floor(Math.min(MAX,top+h/zoom)/span);tz++)for(let tx=Math.floor(Math.max(MIN,left)/span);tx<=Math.floor(Math.min(MAX,left+w/zoom)/span);tx++)result.push({key:`${step}/${tx}/${tz}`,x:tx*span,z:tz*span,step,n:N});
 return result.sort((a,b)=>(a.x+span/2-cx)**2+(a.z+span/2-cz)**2-((b.x+span/2-cx)**2+(b.z+span/2-cz)**2));}
function requestView(){if(!initialized)return;visible=plan();const needed=visible.filter(t=>!tiles.has(t.key));worker.postMessage({type:'view',generation:epoch,tasks:needed});$('progress').textContent=needed.length?`${needed.length} teselas pendientes · detalle ${visible[0]?.step||1} bloques`:'Vista calculada';schedule();clearTimeout(viewTimer);viewTimer=setTimeout(saveHash,200);}
function saveHash(){const u=new URLSearchParams({seed,version:'0.8.0-pre.4',x:Math.round(cx),z:Math.round(cz),zoom:zoom.toPrecision(7)});history.replaceState(null,'','#'+u);}
function schedule(){if(!drawQueued){drawQueued=true;requestAnimationFrame(draw);}}
function draw(){drawQueued=false;ctx.fillStyle='#101922';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 // Retain already computed resolutions while the next level arrives.
 const ordered=[...tiles.values()].sort((a,b)=>b.step-a.step);
 const selected=$('highlight').value;
 for(const t of ordered){const span=t.n*t.step,x=(t.x-cx)*zoom+w/2,z=(t.z-cz)*zoom+h/2,size=span*zoom;if(x>w||z>h||x+size<0||z+size<0)continue;
  let image=t.image;
  if(selected!==''){if(t.maskId!==selected){const pixels=new Uint8ClampedArray(t.pixels);for(let i=0;i<t.ids.length;i++){if(t.ids[i]!==Number(selected)){pixels[i*4]=Math.round(pixels[i*4]*.16);pixels[i*4+1]=Math.round(pixels[i*4+1]*.16);pixels[i*4+2]=Math.round(pixels[i*4+2]*.16);}}t.mask=document.createElement('canvas');t.mask.width=t.mask.height=t.n;t.mask.getContext('2d').putImageData(new ImageData(pixels,t.n,t.n),0,0);t.maskId=selected;}image=t.mask;}
  ctx.drawImage(image,x,z,size+.2,size+.2);}
 if($('grid').checked){const spacing=2**Math.ceil(Math.log2(100/zoom));ctx.strokeStyle='#d9e8ef33';ctx.lineWidth=1;ctx.beginPath();for(let x=Math.ceil((cx-w/2/zoom)/spacing)*spacing;x<cx+w/2/zoom;x+=spacing){const px=(x-cx)*zoom+w/2;ctx.moveTo(px,0);ctx.lineTo(px,h);}for(let z=Math.ceil((cz-h/2/zoom)/spacing)*spacing;z<cz+h/2/zoom;z+=spacing){const py=(z-cz)*zoom+h/2;ctx.moveTo(0,py);ctx.lineTo(w,py);}ctx.stroke();}
 const scale=2**Math.floor(Math.log2(100/zoom));$('scale').textContent=`${scale.toLocaleString('es')} bloques`;$('scale').style.width=Math.max(40,scale*zoom)+'px';
}
worker.onmessage=({data:d})=>{if(d.type==='error'){$('status').textContent='Error: '+d.message;return;}if(d.generation!==epoch)return;
 if(d.type==='ready'){initialized=true;catalog=new Map(d.biomes.map(b=>[b.id,b]));const previous=$('highlight').value;$('highlight').replaceChildren(new Option('Todos los biomas',''),...d.biomes.sort((a,b)=>a.name.localeCompare(b.name)).map(b=>new Option(pretty(b.name),b.id)));$('highlight').value=previous;$('status').textContent=`V1 ${d.version} · biomas de superficie`;requestView();}
 if(d.type==='tile'){const image=document.createElement('canvas');image.width=d.n;image.height=d.n;image.getContext('2d').putImageData(new ImageData(d.pixels,d.n,d.n),0,0);tiles.delete(d.key);tiles.set(d.key,{...d,image});const budget=Math.max(LIMIT,visible.length),protectedKeys=new Set(visible.map(t=>t.key));while(tiles.size>budget){const key=[...tiles.keys()].find(k=>!protectedKeys.has(k));if(!key)break;tiles.delete(key);}const missing=visible.filter(t=>!tiles.has(t.key)).length;$('progress').textContent=missing?`${missing} teselas pendientes`:'Vista calculada';schedule();}
 if(d.type==='point'&&d.request===hover){$('biome').textContent=pretty(d.result.biome);$('position').textContent=`X: ${d.x.toLocaleString('es')} · Z: ${d.z.toLocaleString('es')} · ${pretty(d.result.zone)}`;}
};
worker.onerror=e=>{$('status').textContent='No se pudo iniciar el motor: '+e.message;};
function applySeed(){if(fileMode||workerFailed)return;try{const raw=$('seed').value.trim();if(!/^[+-]?\d{1,19}$/.test(raw))throw Error('Introduce una semilla numérica de 64 bits.');const v=BigInt(raw);if(v<-(1n<<63n)||v>=(1n<<63n))throw Error('La semilla supera el rango de 64 bits.');seed=v.toString();$('seed').value=seed;epoch++;initialized=false;tiles.clear();visible=[];hover++;$('status').textContent='Preparando semilla…';$('biome').textContent='Mueve el cursor sobre el mapa';worker.postMessage({type:'seed',generation:epoch,seed});schedule();saveHash();}catch(e){$('status').textContent=e.message;}}
$('seed-form').onsubmit=e=>{e.preventDefault();applySeed();};
$('random').onclick=()=>{const a=crypto.getRandomValues(new Uint32Array(2));$('seed').value=BigInt.asIntN(64,(BigInt(a[0])<<32n)|BigInt(a[1])).toString();applySeed();};
$('coords').onsubmit=e=>{e.preventDefault();const x=Number($('x').value),z=Number($('z').value);if(!Number.isInteger(x)||!Number.isInteger(z)||x<MIN||x>MAX||z<MIN||z>MAX)return;cx=x;cz=z;requestView();};
$('origin').onclick=()=>{cx=cz=0;$('x').value=$('z').value='0';requestView();};
$('grid').onchange=schedule;
$('highlight').onchange=schedule;
function zoomAt(factor,px=w/2,py=h/2){const before={x:cx+(px-w/2)/zoom,z:cz+(py-h/2)/zoom};zoom=Math.max(2**-24,Math.min(32,zoom*factor));cx=clamp(before.x-(px-w/2)/zoom);cz=clamp(before.z-(py-h/2)/zoom);requestView();}
$('plus').onclick=()=>zoomAt(2);$('minus').onclick=()=>zoomAt(.5);
canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(2**(-e.deltaY/350),e.clientX-r.left,e.clientY-r.top);};
canvas.onpointerdown=e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;};
canvas.onpointermove=e=>{if(pointer){cx=clamp(cx-(e.clientX-pointer.x)/zoom);cz=clamp(cz-(e.clientY-pointer.y)/zoom);pointer.x=e.clientX;pointer.y=e.clientY;requestView();return;}
 const rect=canvas.getBoundingClientRect(),p=world(e.clientX-rect.left,e.clientY-rect.top);$('position').textContent=`X: ${p.x.toLocaleString('es')} · Z: ${p.z.toLocaleString('es')}`;hover++;const request=hover;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{if(initialized)worker.postMessage({type:'point',generation:epoch,request,...p});},65);
};
canvas.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();cx=clamp(cx+d[0]*150/zoom);cz=clamp(cz+d[1]*150/zoom);requestView();}};
$('share').onclick=async()=>{saveHash();try{await navigator.clipboard.writeText(location.href);$('share').textContent='Enlace copiado';}catch{$('status').textContent='Copia la dirección de esta página para compartir la vista.';}};
$('download').onclick=e=>{e.preventDefault();const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`hytale-${seed}-${Math.round(cx)}-${Math.round(cz)}.png`;a.click();};
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();w=Math.round(r.width);h=Math.round(r.height);const ratio=Math.min(devicePixelRatio||1,2);canvas.width=w*ratio;canvas.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);requestView();schedule();}).observe(canvas);
if(!fileMode)applySeed();
