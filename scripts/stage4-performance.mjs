// Actual original UI benchmark, experimental Preview only; own synthetic list.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from '../backend/node_modules/pg/lib/index.js';
import {PREVIEW,previewHeaders,api,intent,confirmed} from './stage3-preview-check.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:'pipe'});
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');const {chromium}=require('playwright-core');
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const report={id:randomUUID(),at:new Date().toISOString(),label:process.argv[2]||'initial',sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'actual original UI, experimental development Preview; own synthetic list; correlated browser and PostgreSQL timings, no fault injection',samples:[],loads:[]};
const folder='docs/stage4/attempts/performance-'+report.id;mkdirSync(folder,{recursive:true});
const cli='/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel';
const deployment=JSON.parse(execFileSync(cli,['inspect',PREVIEW,'--json','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const source=JSON.parse(execFileSync(cli,['api',`/v13/deployments/${deployment.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD`,'--method','GET','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(source.projectId,'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');assert.notEqual(source.target,'production');
if(process.env.STAGE5_EXPECT_SHA)assert.equal(source.gitSource.sha,process.env.STAGE5_EXPECT_SHA,'Benchmark requires the exact verified application source');
report.harness_sha=report.sha;delete report.sha;report.deployment={id:source.id,sha:source.gitSource.sha,url:source.url};

const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
let browser,context;
const median=values=>{const v=values.slice().sort((a,b)=>a-b);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;};
try{
 const h=randomUUID(),create=intent(h,'stage4.household.create',{name:'Performance '+report.id.slice(0,8)},0);assert.equal((await api({action:'command',intent:create},session)).status,202);assert.equal((await confirmed(create,session)).result.status,'committed');report.household_id=h;
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
 if(process.env.STAGE5_EXPECT_SHA)await context.addInitScript(()=>{document.addEventListener('click',event=>{if(globalThis.__stage5TapArmed&&event.isTrusted){globalThis.__stage5TapArmed=false;globalThis.__stage5Tap={mono:performance.now(),wall:Date.now()};}},true);globalThis.__stage5LongTasks={count:0,total_ms:0};try{new PerformanceObserver(list=>{for(const e of list.getEntries()){globalThis.__stage5LongTasks.count++;globalThis.__stage5LongTasks.total_ms+=e.duration;}}).observe({type:'longtask',buffered:true});}catch{}});
 await context.addInitScript(({session,h})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(session));localStorage.setItem(`futurecart.activeHouseholdId:home:${session.user.id}`,h);localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');},{session,h});
 const page=await context.newPage();const cdp=process.env.STAGE5_EXPECT_SHA?await context.newCDPSession(page):null;if(cdp)await cdp.send('Performance.enable');
 if(cdp){report.network={business:{requests:0,bytes:0},monitoring:{requests:0,bytes:0}};page.on('requestfinished',async request=>{try{const key=request.url()===PREVIEW+'/api/dev-performance'?'monitoring':request.url()===PREVIEW+'/api/stage3'?'business':null;if(!key)return;const sizes=await request.sizes();report.network[key].requests++;report.network[key].bytes+=sizes.requestBodySize+sizes.responseBodySize;}catch{}});}
 page.setDefaultTimeout(90000);const load=Date.now();await page.goto(PREVIEW+'/');await page.getByRole('button',{name:'New category',exact:true}).waitFor();report.loads.push({kind:'first-browser-context',navigation_to_ready_ms:Date.now()-load,cold_function_instance_known:false});
 const responses=new Map();page.on('response',async r=>{try{if(r.url()===PREVIEW+'/api/stage3'){const body=r.request().postDataJSON();if(body.action==='command')responses.set(body.intent.id,{received:Date.now(),body:await r.json()});}}catch{}});
 async function measure(kind,logicalType,predicate,action,visible){
  const request=page.waitForRequest(r=>{try{const b=r.postDataJSON();return r.url()===PREVIEW+'/api/stage3'&&b.action==='command'&&b.intent.type==='stage4.'+logicalType&&predicate(b.intent);}catch{return false;}});
  if(cdp)await page.evaluate(()=>{globalThis.__stage5TapArmed=true;globalThis.__stage5Tap=null;});
  const tap=Date.now();const actionVisible=(async()=>{await action();await visible();return Date.now();})();
  const [r,visibleAt]=await Promise.all([request,actionVisible]);const i=r.postDataJSON().intent;
  await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).some(k=>{try{const committed=JSON.parse(localStorage.getItem(k)).some(o=>o.intent.id===id&&o.result?.status==='committed');return committed&&(!globalThis.__stage5Tap||Boolean(document.querySelector(`[data-operation-id="${id}"][data-state="Saved"]`)));}catch{return false;}}),i.id);
  const savedAt=Date.now();const actualTap=cdp?await page.evaluate(()=>globalThis.__stage5Tap?{...globalThis.__stage5Tap,savedMono:performance.now()}:null):null;const accepted=responses.get(i.id);assert.ok(accepted,'acceptance response observed');
  const rows=(await db.query('SELECT o.committed_at,x.created_at,x.delivered_at,x.attempts,o.result FROM shopping.operations o JOIN shopping.result_outbox x ON x.operation_id=o.id WHERE o.id=$1',[i.id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].result.status,'committed');
  const sample={measurement_start:actualTap?'trusted DOM click':'automation action call (includes actionability wait)',saved_boundary:actualTap?'React Saved DOM and committed client storage':'committed client storage',automation_action_to_saved_ms:savedAt-tap,automation_action_to_visible_ms:visibleAt-tap,kind,operation_id:i.id,correlation_id:i.correlation_id,context:'warm-browser-context',tap_to_visible_feedback_ms:visibleAt-(actualTap?.wall??tap),tap_to_api_acceptance_ms:accepted.received-(actualTap?.wall??tap),tap_to_saved_ms:actualTap?actualTap.savedMono-actualTap.mono:savedAt-tap,api_status:accepted.body.state,api_timings:accepted.body.timings||null,database_commit_at:rows[0].committed_at,outbox_created_at:rows[0].created_at,outbox_delivered_at:rows[0].delivered_at,callback_attempts:rows[0].attempts,clock_note:'Cross-host wall clocks not used for precise duration claims.'};report.samples.push(sample);appendFileSync(folder+'/samples.jsonl',JSON.stringify(sample)+'\n');return i;
 }
 const cat='Measured '+report.id.slice(0,8);await page.getByRole('button',{name:'New category',exact:true}).click();await page.getByPlaceholder('Category name',{exact:true}).fill(cat);
 await measure('category.create','category.create',i=>i.payload.name===cat,()=>page.getByRole('button',{name:'Create',exact:true}).click(),()=>page.getByRole('heading',{name:cat,exact:true}).waitFor());
 await page.getByRole('heading',{name:cat,exact:true}).click();const modal=page.getByRole('heading',{name:cat,exact:true,level:2}).locator('xpath=ancestor::div[contains(@class,"max-w-xl")][1]');
 const count=Number(process.env.STAGE4_PERF_SAMPLES||5);assert.ok(count>=3&&count<=20);
 let productId,name;
 for(let x=0;x<count;x++){
  const n='Measured item '+report.id.slice(0,8)+' '+x;await modal.getByPlaceholder('Add product',{exact:true}).fill(n);
  const created=await measure('product.create','product.create',i=>i.payload.name===n,()=>modal.getByRole('button',{name:'Add',exact:true}).click(),()=>modal.getByText(n,{exact:true}).waitFor());if(x===0){name=n;productId=created.payload.id;}
 }
 for(let x=0;x<count*2;x++){
  const checked=x%2===0;
  const button=modal.getByRole('button',{name:new RegExp('^'+name+'\\s*\\d+x$')});
  await measure(checked?'product.check':'product.uncheck','product.update',i=>i.payload.id===productId&&i.payload.checked===checked,()=>button.click(),()=>page.waitForFunction(({name,checked})=>{const span=[...document.querySelectorAll('span')].find(s=>s.textContent===name&&s.closest('button')?.querySelector('.rounded-full'));return span?.closest('button').parentElement.className.includes('border-cyan-400')===checked;},{name,checked}));
 }
 await measure('product.check','product.update',i=>i.payload.id===productId&&i.payload.checked===true,()=>modal.getByRole('button',{name:new RegExp('^'+name+'\\s*\\d+x$')}).click(),()=>Promise.resolve());
 await modal.getByRole('button',{name:'Close',exact:true}).click();
 for(let x=0;x<count;x++){
  const quantity=x+2;await measure('product.quantity','product.update',i=>i.payload.id===productId&&i.payload.quantity===quantity,()=>page.getByRole('button',{name:'Increase '+name,exact:true}).filter({visible:true}).click(),()=>page.waitForFunction(({name,quantity})=>document.querySelector(`button[aria-label="Increase ${name}"]`)?.parentElement.querySelector('span')?.textContent===String(quantity),{name,quantity}));
 }
 if(cdp){report.browser_resources={long_tasks:await page.evaluate(()=>globalThis.__stage5LongTasks),cdp_metrics:(await cdp.send('Performance.getMetrics')).metrics.filter(m=>['TaskDuration','ScriptDuration','JSHeapUsedSize','JSHeapTotalSize'].includes(m.name))};}
 await page.screenshot({path:folder+'/desktop.png',fullPage:true});const reload=Date.now();await page.reload();await page.getByRole('button',{name:'New category',exact:true}).waitFor();report.loads.push({kind:'warm-browser-reload',navigation_to_ready_ms:Date.now()-reload,cold_function_instance_known:false});
 report.summary={};for(const kind of new Set(report.samples.map(s=>s.kind))){const s=report.samples.filter(s=>s.kind===kind);report.summary[kind]={n:s.length,median_visible_feedback_ms:median(s.map(x=>x.tap_to_visible_feedback_ms)),median_api_acceptance_ms:median(s.map(x=>x.tap_to_api_acceptance_ms)),median_saved_ms:median(s.map(x=>x.tap_to_saved_ms)),tail_percentiles:'Not reported: exploratory small cohort'};}
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,message:String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]').slice(0,2000)};process.exitCode=1;}
finally{await context?.close();await browser?.close();await db.end();writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,folder,summary:report.summary,error:report.error}));}
