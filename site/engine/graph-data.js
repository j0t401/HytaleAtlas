'use strict';
/** Lossless binary climate tables, shared by biome and terrain graphs. */
const V1GraphData=(()=>{
 const tables=new Map();
 async function load(path,getFile){
  const raw=JSON.parse(new TextDecoder().decode(await getFile(path)));
  await Promise.all(raw.nodes.map(async node=>{const spec=node.values;if(!spec?.$binary)return;const key=spec.$binary;
   if(!tables.has(key))tables.set(key,(async()=>{let buffer;if(typeof DecompressionStream!=='undefined'){const bytes=await getFile(key+'.gz'),signature=new Uint8Array(bytes);buffer=signature[0]===31&&signature[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;}else buffer=await getFile(key);
    const size=spec.kind==='f64'?8:4;if(buffer.byteLength!==spec.length*size)throw Error('Invalid climate table size');return spec.kind==='f64'?new Float64Array(buffer):new Int32Array(buffer);})().catch(e=>{tables.delete(key);throw e;}));
   node.values=await tables.get(key);
  }));return raw;
 }
 return{load};
})();
globalThis.V1GraphData=V1GraphData;if(typeof module!=='undefined')module.exports=V1GraphData;
