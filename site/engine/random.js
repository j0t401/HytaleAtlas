'use strict';
/** Integer arithmetic used by V1 prefab/cave placement; Java long overflow retained. */
const V1Integer=(()=>{
 const signed=x=>BigInt.asIntN(64,BigInt(x)),unsigned=x=>BigInt.asUintN(64,x);
 const C1=-4658895280553007687n,C2=-7723592293110705685n,C3=-6389720478792763523n;
 function mix(value){let x=signed(value);x=signed((unsigned(x)>>30n^x)*C1);x=signed((unsigned(x)>>27n^x)*C2);return signed(unsigned(x)>>31n^x);}
 function hash(...values){if(values.length===1)return mix(values[0]);let x=signed(values[0]);x=signed((unsigned(mix(x))>>30n^x)*C1);if(values.length===2)return signed(unsigned(mix(values[1]))>>31n^x);x=signed((unsigned(mix(values[1]))>>27n^x)*C2);if(values.length===3)return signed(unsigned(mix(values[2]))>>31n^x);if(values.length===4){x=signed((unsigned(mix(values[2]))>>30n^x)*C3);return signed(unsigned(mix(values[3]))>>31n^x);}throw Error('Hash requires 1 to 4 arguments');}
 function random(...values){return Number(BigInt.asUintN(32,mix(hash(...values))))/4294967295;}
 class FastRandom{
  constructor(seed){this.setSeed(seed);}
  setSeed(seed){this.state=(BigInt(seed)^25214903917n)&281474976710655n;}
  next(bits){this.state=(this.state*25214903917n+11n)&281474976710655n;const value=Number(this.state>>BigInt(48-bits));return bits===32?value|0:value;}
  nextDouble(){return(this.next(26)*134217728+this.next(27))/9007199254740992;}
  nextFloat(){return Math.fround(this.next(24)/16777216);}
  nextInt(bound){if(bound===undefined)return this.next(32);if(!Number.isInteger(bound)||bound<=0||bound>2147483647)throw Error('Invalid Java random bound');if((bound&-bound)===bound)return Number(BigInt(bound)*BigInt(this.next(31))>>31n);let bits,val;do{bits=this.next(31);val=bits%bound;}while((bits-val+(bound-1)|0)<0);return val;}
  nextLong(){return signed((BigInt(this.next(32))<<32n)+BigInt(this.next(32)));}
 }
 return{hash,random,mix,FastRandom,signed};
})();
globalThis.V1Integer=V1Integer;if(typeof module!=='undefined')module.exports=V1Integer;
