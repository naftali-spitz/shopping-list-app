import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
let src=readFileSync(new URL('./browser.ts',import.meta.url),'utf8').replace("import { supabase } from '@/lib/supabase';",'const supabase=globalThis.__monitorAuth;');
for(const f of ['buffer','contract'])src=src.replace(`'./${f}.mjs'`,JSON.stringify(new URL(`./${f}.mjs`,import.meta.url).href));
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
let serial=0;const clients=[];const user=randomUUID(),house=randomUUID();
async function setup(){
 const data=new Map();globalThis.localStorage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 globalThis.window={addEventListener(){},removeEventListener(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,userAgent:'Synthetic desktop'}});
 globalThis.__monitorAuth={auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:'fixture'}}})}};
 const requests=[];let unavailable=false,mode='MID';
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);if(body.action==='config')return Response.json({mode});if(unavailable)throw new Error('isolated monitoring storage failure');return Response.json({persisted:true});};
 const browserModule=await import('data:text/javascript;base64,'+Buffer.from(js+`\n// ${serial++}`).toString('base64'));
 const create=()=>{const c=new browserModule.BrowserMonitoring(user,house);clients.push(c);return c;};
 return {create,data,requests,fail:value=>{unavailable=value;},mode:value=>{mode=value;}};
}
function intent(){return {id:randomUUID(),correlation_id:randomUUID(),household_id:house,type:'stage4.product.update',issued_ms:Date.now()};}
afterEach(()=>{for(const c of clients.splice(0))c.dispose();});
test('actual browser collector buffers offline without a network call; authenticated retry acknowledges delivery',async()=>{
 const s=await setup(),c=s.create();c.buffer.setMode('MID');navigator.onLine=false;const i=intent();c.begin(i);c.finish(i,true);assert.equal(c.buffer.items.length,1);await c.flush();assert.equal(s.requests.length,0);navigator.onLine=true;await c.flush();assert.equal(c.buffer.items.length,0);assert.equal(c.buffer.delivered,1);
});
test('failed telemetry storage does not throw to shopping caller and survives collector refresh with immutable record ID',async()=>{
 const s=await setup(),c=s.create();c.buffer.setMode('ON');s.mode('ON');s.fail(true);const i=intent();c.begin(i);assert.doesNotThrow(()=>c.finish(i,true));const id=c.buffer.items[0].id;await c.flush();assert.equal(c.buffer.items[0].id,id);assert.equal(s.data.size,1);c.dispose();const restored=s.create();s.fail(false);await restored.flush();assert.ok(s.requests.some(r=>r.records?.some(x=>x.id===id)));assert.equal(s.data.size,0);
});
test('independent browser tabs preserve distinct delivery records and server-acknowledged duplicate IDs',async()=>{
 const s=await setup(),a=s.create(),b=s.create();a.buffer.setMode('MID');b.buffer.setMode('MID');s.fail(true);
 for(const c of [a,b]){const i=intent();c.begin(i);c.finish(i,true);await c.flush();}assert.equal(s.data.size,2);const ids=[...s.data.values()].map(v=>JSON.parse(v).record.id);assert.equal(new Set(ids).size,2);s.fail(false);await a.flush();await b.flush();assert.equal(s.data.size,0);
});
test('OFF refresh discards active traces and retained batches without invoking ingestion',async()=>{
 const s=await setup(),c=s.create();c.buffer.setMode('ON');const i=intent();c.begin(i);c.finish(i,true);s.mode('OFF');await c.flush();assert.equal(c.buffer.items.length,0);assert.equal(s.requests.filter(r=>r.action==='ingest').length,0);c.begin(i);c.finish(i,true);assert.equal(c.buffer.items.length,0);
});
test('failed/conflicting outcome does not report a successful tap-to-Saved time',async()=>{const s=await setup(),c=s.create();c.buffer.setMode('MID');const i=intent();c.begin(i);c.finish(i,false);assert.equal(c.buffer.items[0].metrics.tap_saved_ms,undefined);});
test('expired or changed session retains diagnostic records and never sends as a different actor',async()=>{const s=await setup(),c=s.create();c.buffer.setMode('MID');const i=intent();c.begin(i);c.finish(i,true);globalThis.__monitorAuth.auth.getSession=async()=>({data:{session:{user:{id:randomUUID()},access_token:'other'}}});await c.flush();assert.equal(c.buffer.items.length,1);assert.equal(s.requests.length,0);});
test('render evidence follows UI commit/frame callbacks without delaying confirmed state',async()=>{
 const s=await setup(),c=s.create();c.buffer.setMode('ON');const frames=[];
 globalThis.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};globalThis.document={hidden:false};
 try{
  const i=intent();c.begin(i);c.rendered(i,false);while(frames.length)frames.shift()();
  c.finish(i,true);assert.equal(c.buffer.items.length,1);assert.ok(c.buffer.items[0].metrics.tap_optimistic_ms>=0);
  c.rendered(i,true);assert.equal(c.buffer.items.length,1);while(frames.length)frames.shift()();
  assert.equal(c.buffer.items.length,2);assert.ok(c.buffer.items[1].metrics.tap_saved_render_ms>=c.buffer.items[0].metrics.tap_saved_ms);
  assert.equal(c.buffer.items[1].correlation_id,i.correlation_id);
 }finally{delete globalThis.requestAnimationFrame;delete globalThis.document;}
});
