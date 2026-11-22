/** No timers, I/O or serialization on capture. Flush belongs to an independent task. */
export class BatchBuffer {
  constructor({capacity=500,batchSize=50,maxBytes=96000}={}) {
    if(!Number.isInteger(capacity)||capacity<1||capacity>10000||!Number.isInteger(batchSize)||batchSize<1||batchSize>100||!Number.isInteger(maxBytes)||maxBytes<256||maxBytes>120000)throw new Error('invalid_limits');
    this.maxBytes=maxBytes;this.encoder=new TextEncoder();this.capacity=capacity;this.batchSize=batchSize;this.items=[];this.dropped=0;this.failures=0;this.delivered=0;this.busy=false;this.mode='OFF';
  }
  setMode(mode) {if(!['OFF','MID','ON'].includes(mode))throw new Error('invalid_mode');this.mode=mode;if(mode==='OFF')this.items=[];}
  capture(record) {if(this.mode==='OFF')return false;if(!record||typeof record.id!=='string'){this.dropped++;return false;}if(this.items.length>=this.capacity){this.dropped++;return false;}this.items.push(record);return true;}
  async flush(send) {
    if(this.busy||this.mode==='OFF'||!this.items.length)return;
    this.busy=true;const batch=[];
    try {let bytes=2;for(const record of this.items.slice(0,this.batchSize)){let size;try{size=this.encoder.encode(JSON.stringify(record)).length+1;}catch{this.failures++;size=this.maxBytes+1;}if(size>this.maxBytes){this.items=this.items.filter(x=>x.id!==record.id);this.dropped++;continue;}if(bytes+size>this.maxBytes)break;batch.push(record);bytes+=size;}if(!batch.length)return;const ack=await send(batch);if(!ack?.persisted)throw new Error('unconfirmed_batch');const ids=new Set(batch.map(x=>x.id));this.items=this.items.filter(x=>!ids.has(x.id));this.dropped+=Math.min(batch.length,ack.rejected??0);this.delivered+=batch.length-Math.min(batch.length,ack.rejected??0);}
    catch {this.failures++;}finally{this.busy=false;}
  }
  health(){return {depth:this.items.length,dropped:this.dropped,failures:this.failures,delivered:this.delivered};}
}
