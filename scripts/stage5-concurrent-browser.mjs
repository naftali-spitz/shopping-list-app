// Two real Dev users, isolated synthetic household, actual root UI and same-ID transport retry.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {PREVIEW,previewHeaders,api,intent,confirmed} from './stage3-preview-check.mjs';
import {DEV_SUPABASE} from '../integration/stage3/identity.mjs';
import pg from '../backend/node_modules/pg/lib/index.js';
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json'),{chromium}=require('playwright-core');
const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json')),config=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json')).variables;
assert.equal(config.NEXT_PUBLIC_SUPABASE_URL,DEV_SUPABASE);
const report={id:randomUUID(),at:new Date().toISOString(),scope:'two real Dev actors in separate browser contexts; synthetic fixture; no host/network faults; exploratory concurrent latency, not capacity',checks:[],samples:[]};
const folder='docs/stage5/attempts/concurrent-'+report.id;mkdirSync(folder,{recursive:true});
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
let browser;const contexts=[];
async function command(i,session){const a=await api({action:'command',intent:i},session);assert.ok([200,202].includes(a.status));const result=await confirmed(i,session);assert.equal(result.result.status,'committed');return result;}
async function history(session,h){const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'history',household_id:h}),signal:AbortSignal.timeout(20000)});assert.ok(r.ok);return (await r.json()).operations;}
try{
 const h=randomUUID(),category=randomUUID(),product=randomUUID();report.household_id=h;
 await command(intent(h,'stage4.household.create',{name:'Concurrent monitoring '+report.id.slice(0,8)},0),sessions[0]);
 await command(intent(h,'stage4.category.create',{id:category,name:'Concurrent probe',icon:'general'},0),sessions[0]);
 await command(intent(h,'stage4.product.create',{id:product,category_id:category,name:'Concurrent item',checked:true,quantity:1},0),sessions[0]);
 const token=randomBytes(24).toString('hex');await command(intent(h,'stage4.invite.create',{id:randomUUID(),token},null),sessions[0]);
 await command(intent(sessions[1].user.id,'stage4.invite.accept',{token},null),sessions[1]);
 report.checks.push('shared synthetic household joined through verified invitation, no admin membership bypass');
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const pages=[];
 for(const s of sessions.slice(0,2)){
  const context=await browser.newContext({viewport:{width:1100,height:900}});contexts.push(context);
  await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
  await context.addInitScript(({s,h})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(s));localStorage.setItem(`futurecart.activeHouseholdId:home:${s.user.id}`,h);localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');},{s,h});
  const page=await context.newPage();page.setDefaultTimeout(90000);await page.goto(PREVIEW+'/');await page.getByRole('button',{name:'Increase Concurrent item',exact:true}).waitFor();pages.push(page);
 }
 const requests=pages.map(page=>page.waitForRequest(r=>{try{return r.url()===PREVIEW+'/api/stage3'&&r.postDataJSON().action==='command'&&r.postDataJSON().intent.type==='stage4.product.update';}catch{return false;}}));
 const taps=pages.map(()=>Date.now());await Promise.all(pages.map(page=>page.getByRole('button',{name:'Increase Concurrent item',exact:true}).click()));
 const operations=await Promise.all(requests.map(async r=>(await r).postDataJSON().intent));
 assert.equal(operations[0].expected_version,operations[1].expected_version);
 await Promise.all(pages.map(async(page,index)=>{
  const op=operations[index];await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).some(k=>{try{return JSON.parse(localStorage.getItem(k)).some(o=>o.intent.id===id&&o.result);}catch{return false;}}),op.id);
  const result=await page.evaluate(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).flatMap(k=>JSON.parse(localStorage.getItem(k))).find(o=>o.intent.id===id).result,op.id);
  report.samples.push({actor:index,operation_id:op.id,correlation_id:op.correlation_id,outcome:result.status,tap_to_terminal_ms:Date.now()-taps[index]});
  await page.screenshot({path:folder+`/actor-${index}.png`,fullPage:true});
 }));
 assert.deepEqual(report.samples.map(s=>s.outcome).sort(),['committed','version_conflict']);
 assert.equal(Number((await db.query('SELECT quantity FROM shopping.products WHERE id=$1',[product])).rows[0].quantity),2);
 report.checks.push('simultaneous UI edits produce one committed save and one explicit version conflict, one business increment');
 await Promise.all(contexts.map(c=>c.close()));contexts.length=0;
 const duplicate=intent(h,'stage4.category.create',{id:randomUUID(),name:'Duplicate transport probe',icon:'general'},0);
 const accepted=await Promise.all([api({action:'command',intent:duplicate},sessions[0]),api({action:'command',intent:duplicate},sessions[0])]);assert.ok(accepted.every(r=>[200,202].includes(r.status)));
 assert.equal((await confirmed(duplicate,sessions[0])).result.status,'committed');
 const counts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) ledger,(SELECT count(*)::int FROM shopping.categories WHERE id=$2) business',[duplicate.id,duplicate.payload.id])).rows[0];assert.deepEqual(counts,{ledger:1,business:1});
 report.checks.push('simultaneous identical-ID API/MQTT publication has one ledger row and one business effect');report.duplicate_operation_id=duplicate.id;
 await new Promise(r=>setTimeout(r,11000));
 const own=await history(sessions[0],h),other=await history(sessions[1],h);
 const a=report.samples.find(s=>s.actor===0).operation_id,b=report.samples.find(s=>s.actor===1).operation_id;
 assert.ok(own.some(o=>o.operation_id===a)&&!own.some(o=>o.operation_id===b));assert.ok(other.some(o=>o.operation_id===b)&&!other.some(o=>o.operation_id===a));
 assert.equal(own.filter(o=>o.operation_id===duplicate.id).length,1);
 report.checks.push('persistent history remains actor-isolated even inside a shared household; retries have one history operation');
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,message:error.message.slice(0,1500)};process.exitCode=1;}
finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser?.close();await db.end();writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({folder,...report}));}
