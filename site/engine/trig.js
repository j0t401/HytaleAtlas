'use strict';
function createV1Trig(buffer){
 const F=Math.fround,data=buffer instanceof Uint8Array?new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength):new DataView(buffer),SIN=new Float32Array(4096),COS=new Float32Array(4096);
 if(data.byteLength!==32768)throw Error('Invalid V1 trigonometric table');
 for(let i=0;i<4096;i++){SIN[i]=data.getFloat32(i*4,true);COS[i]=data.getFloat32(16384+i*4,true);}
 const factor=F(4096/F(F(Math.PI)*2)),castInt=x=>Number.isNaN(x)?0:Math.max(-2147483648,Math.min(2147483647,Math.trunc(x))),index=x=>castInt(F(F(x)*factor))&4095;
 return{sin:x=>SIN[index(x)],cos:x=>COS[index(x)]};
}
globalThis.createV1Trig=createV1Trig;if(typeof module!=='undefined')module.exports=createV1Trig;
