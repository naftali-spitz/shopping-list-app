// Bounded controlled faults affect only the dedicated development listener.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{randomUUID}from'node:crypto';
import{createRequire}from'node:module';
import pg from'../backend/node_modules/pg/lib/index.js';
import{PREVIEW,previewHeaders,api,intent,confirmed}from'./stage3-preview-check.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:'pipe'});
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json'),{chromium}=require('playwright-core');
const path='.stage0-runtime/stage3-config.json',original=JSON.parse(readFileSync(path)),report={id:randomUUID(),at:new Date().toISOString(),scope:'actual original-app browser adapter with bounded dedicated listener MQTT stream interruption and separately delayed HTTPS callback; no router/ISP/system firewall faults',checks:[]};
const folder='docs/stage4/attempts/fault-browser-'+report.id;mkdirSync(folder,{recursive:true});
report.harness_sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const cli='/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel';
const inspect=JSON.parse(execFileSync(cli,['inspect',PREVIEW,'--json','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const deployed=JSON.parse(execFileSync(cli,['api',`/v13/deployments/${inspect.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD`,'--method','GET','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(deployed.projectId,'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');assert.notEqual(deployed.target,'production');assert.equal(deployed.gitSource.ref,'feature/flespi-home-backend');
report.deployment={id:deployed.id,url:deployed.url,sha:deployed.gitSource.sha,git_ref:deployed.gitSource.ref};
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0],h=randomUUID();
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const pgPid=execFileSync('systemctl',['--user','show','shopping-list-stage0-postgres.service','-p','MainPID','--value'],{encoding:'utf8'}).trim();
let browser,context,page;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fault=(fields,ms=15000)=>writeFileSync('.stage0-runtime/stage3-fault.json',JSON.stringify({until:Date.now()+ms,...fields}),{mode:0o600});
const record=(name,evidence={})=>{report.checks.push({name,status:'PASS',...evidence});writeFileSync(folder+'/in-progress.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase:name}));};
async function count(id,pid){return(await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox,(SELECT count(*)::int FROM shopping.products WHERE id=$2) AS products',[id,pid])).rows[0];}
async function currentOperation(id){return page.evaluate(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).flatMap(k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return[];}}).find(p=>p.intent.id===id),id);}
async function add(name){const request=page.waitForRequest(r=>{try{const b=r.postDataJSON();return b.action==='command'&&b.intent?.type==='stage4.product.create'&&b.intent.payload.name===name;}catch{return false;}});await page.getByPlaceholder('Add product',{exact:true}).fill(name);await page.getByRole('button',{name:'Add',exact:true}).click();return(await request).postDataJSON().intent;}
try{
 assert.equal(original.faultInjectionEnabled===true,false);writeFileSync(path,JSON.stringify({...original,faultInjectionEnabled:true}),{mode:0o600});fault({});execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:'pipe'});
 const ch=intent(h,'stage4.household.create',{name:'Fault browser '+report.id.slice(0,8)},0);await api({action:'command',intent:ch},session);assert.equal((await confirmed(ch,session)).result.status,'committed');
 const cat=intent(h,'stage4.category.create',{id:randomUUID(),name:'Recovery',icon:'general'},0);await api({action:'command',intent:cat},session);assert.equal((await confirmed(cat,session)).result.status,'committed');
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});context=await browser.newContext({viewport:{width:1280,height:900}});await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
 await context.addInitScript(({s,h})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(s));localStorage.setItem(`futurecart.activeHouseholdId:home:${s.user.id}`,h);localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');},{s:session,h});page=await context.newPage();page.setDefaultTimeout(90000);await page.goto(PREVIEW+'/');await page.getByRole('heading',{name:'Recovery',exact:true,level:3}).click();
 fault({mqttOffline:true},8000);const deadline=Date.now()+6000;while(Date.now()<deadline&&JSON.parse(readFileSync('.stage0-runtime/stage3-health.json')).connected)await delay(200);assert.equal(JSON.parse(readFileSync('.stage0-runtime/stage3-health.json')).connected,false);
 const interrupted=await add('Short interruption '+report.id.slice(0,8));assert.notEqual((await currentOperation(interrupted.id)).state,'Saved');await page.screenshot({path:folder+'/mqtt-pending.png',fullPage:true});await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).some(k=>JSON.parse(localStorage.getItem(k)).some(p=>p.intent.id===id&&p.result?.status==='committed')),interrupted.id);assert.deepEqual(await count(interrupted.id,interrupted.payload.id),{ledger:1,outbox:1,products:1});record('bounded8s actual owned MQTT stream interruption preserves pending then commits once',{operation_id:interrupted.id,correlation_id:interrupted.correlation_id});
 fault({callbackOffline:true},22000);const delayed=await add('Delayed callback '+report.id.slice(0,8));const commitDeadline=Date.now()+15000;let counts;while(Date.now()<commitDeadline){counts=await count(delayed.id,delayed.payload.id);if(counts.ledger===1)break;await delay(250);}assert.deepEqual(counts,{ledger:1,outbox:1,products:1});assert.equal((await currentOperation(delayed.id)).result,undefined);await page.screenshot({path:folder+'/commit-callback-pending.png',fullPage:true});
 await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).some(k=>JSON.parse(localStorage.getItem(k)).some(p=>p.intent.id===id&&p.result?.status==='committed')),delayed.id);
 const duplicate=await api({action:'command',intent:delayed},session);assert.equal(duplicate.data.result.status,'committed');assert.deepEqual(await count(delayed.id,delayed.payload.id),{ledger:1,outbox:1,products:1});const outbox=(await db.query('SELECT attempts,delivered_at FROM shopping.result_outbox WHERE operation_id=$1',[delayed.id])).rows[0];record('actual PostgreSQL commit remains UI pending during22s callback refusal then Saved and same-ID retry has one effect',{operation_id:delayed.id,correlation_id:delayed.correlation_id,outbox});
 assert.equal(execFileSync('systemctl',['--user','show','shopping-list-stage0-postgres.service','-p','MainPID','--value'],{encoding:'utf8'}).trim(),pgPid);await page.screenshot({path:folder+'/recovered.png',fullPage:true});report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,message:String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]').slice(0,1500)};process.exitCode=1;}
finally{fault({},1);writeFileSync(path,JSON.stringify({...original,faultInjectionEnabled:false}),{mode:0o600});try{execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:'pipe'});report.faults_disabled=true;}catch{report.faults_disabled=false;}try{await context?.close();}catch{}try{await browser?.close();}catch{}await db.end();writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,folder,checks:report.checks.length,error:report.error}));}
