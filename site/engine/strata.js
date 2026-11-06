'use strict';
class V1Strata{
 constructor(k,raw){this.k=k;const data=V1Kernel.decodeGraph(raw).data;this.biomes=new Map(data.biomes.map(b=>[b.id,b]));this.catalog=data.catalog;this.datasetId=data.datasetId;for(const [id,b]of this.biomes)k.biomes.get(id).environments=b.environments;}
 bands(x,z,biomeId,column=new Uint16Array(320)){const k=this.k,b=this.biomes.get(biomeId??k.at(x,z).biomeId);column.fill(k.environmentAt(x,z));for(const l of b.layers){if(!k.condition(l.mapCondition,x,z))continue;const e=l.entries.find(e=>k.condition(e.mapCondition,x,z));if(!e)continue;const min=Math.max(0,Math.floor(k.supplier(e.min,x,z))),max=Math.min(320,Math.floor(k.supplier(e.max,x,z)));if(l.environmentId!==-2147483648&&max>min)column.fill(l.environmentId,min,max);let layerY=Math.floor(k.supplier(e.max,x,z)),stopped=false;for(const item of e.repetitions){const n=k.repetitions(item,x,z);if(n>0){layerY-=n;if(layerY<=min){stopped=true;break;}}}if(stopped)break;}const runs=[];let previous=-1;for(let y=0;y<320;y++)if(column[y]!==previous){runs.push(y,column[y]);previous=column[y];}return runs;}
 static at(offsets,values,index,y){let env=0;for(let i=offsets[index];i<offsets[index+1];i+=2){if(values[i]>y)break;env=values[i+1];}return env;}
}
globalThis.V1Strata=V1Strata;if(typeof module!=='undefined')module.exports=V1Strata;
