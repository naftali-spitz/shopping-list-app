// Actual feature-only fallback/re-enable, retaining PostgreSQL and pending IDs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from '../backend/node_modules/pg/lib/index.js';
import {PREVIEW,previewHeaders,api,intent,confirmed} from './stage3-preview-check.mjs';
const CLI='/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',PROJECT='prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM',TEAM='team_h5ZyD1rMpbgnak6COakN03nD',SCOPE='0012ab-5576s-projects';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:'pipe'});
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');const {chromium}=require('playwright-core');
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual feature Preview Stage4 flag off/on; original Supabase Dev UI and retained PostgreSQL outcomes; no production deploy or data change',checks:[]};
const folder='docs/stage4/attempts/rollback-'+report.id;mkdirSync(folder,{recursive:true});
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0],dev=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json')).variables;
assert.equal(dev.NEXT_PUBLIC_SUPABASE_URL,'https://njomxqthjglqesxchlbm.supabase.co');
const fixture=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json')).households[0];
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const cli=args=>execFileSync(CLI,[...args,'--scope',SCOPE,'--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:240000});
const project=()=>JSON.parse(cli(['api',`/v9/projects/${PROJECT}?teamId=${TEAM}`,'--method','GET']));
const production=p=>({deployment:p.targets.production.id,env:p.env.filter(r=>r.target.includes('production')).map(r=>({id:r.id,key:r.key,target:r.target,type:r.type,createdAt:r.createdAt})).sort((a,b)=>a.id.localeCompare(b.id))});
const record=(name,data={})=>{report.checks.push({name,status:'PASS',...data});writeFileSync(folder+'/in-progress.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase:name}));};
let sourceUrl,before,changed=false,browser,context,page,pendingId,homeHousehold,retainedHash,suspending=false;
function flag(value){execFileSync('python3',['scripts/stage4-feature-flag.py',value],{stdio:'pipe'});}
function deploy(phase){
 console.log(JSON.stringify({phase,status:'redeploying_verified_feature_source'}));
 const output=cli(['redeploy',sourceUrl,'--environment','preview']);
 const urls=output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g);assert.ok(urls?.length);
 const url=urls[urls.length-1],d=JSON.parse(cli(['inspect',url,'--json']));assert.equal(d.readyState,'READY');assert.notEqual(d.target,'production');
 const verified=JSON.parse(cli(['api',`/v13/deployments/${d.id}?teamId=${TEAM}`,'--method','GET']));assert.equal(verified.projectId,PROJECT);assert.equal(verified.gitSource.ref,'feature/flespi-home-backend');assert.equal(verified.gitSource.sha,report.source_sha);
 cli(['alias','set',url,PREVIEW.replace('https://','')]);report[phase]={id:d.id,url,sha:verified.gitSource.sha};
}
async function selection(expected) {
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  const r=await fetch(PREVIEW+'/?selection='+randomUUID(),{headers:previewHeaders(),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const text=await r.text();
  if(r.ok&&new RegExp('backend.{0,15}'+expected).test(text)){report.alias_selection_verified=expected;return;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error('Feature alias did not serve expected backend after rebuild');
}

async function freshContext(){
 context=await browser.newContext({viewport:{width:1365,height:1000}});
 await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
 await context.addInitScript(({session,fixture,home})=>{
  localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(session));localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');localStorage.setItem('futurecart.activeHouseholdId',fixture);localStorage.setItem(`futurecart.activeHouseholdId:home:${session.user.id}`,home);
 },{session,fixture,home:homeHousehold});page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('response',response=>{const url=new URL(response.url());if(!url.pathname.startsWith('/_next/'))(report.browser_responses??=[]).push({origin:url.origin,path:url.pathname,status:response.status()});});
 page.on('pageerror',error=>{if(!/localStorage.*Access is denied/.test(String(error.message)))(report.browser_errors??=[]).push(String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]').slice(0,300));});
}
try{
 before=production(project());const current=JSON.parse(cli(['inspect',PREVIEW,'--json']));const source=JSON.parse(cli(['api',`/v13/deployments/${current.id}?teamId=${TEAM}`,'--method','GET']));assert.equal(source.projectId,PROJECT);assert.equal(source.gitSource.ref,'feature/flespi-home-backend');assert.notEqual(source.target,'production');sourceUrl='https://'+source.url;report.source_sha=source.gitSource.sha;
 homeHousehold=randomUUID();const create=intent(homeHousehold,'stage4.household.create',{name:'Rollback '+report.id.slice(0,8)},0);assert.equal((await api({action:'command',intent:create},session)).status,202);assert.equal((await confirmed(create,session)).result.status,'committed');
 const category=intent(homeHousehold,'stage4.category.create',{id:randomUUID(),name:'Rollback evidence',icon:'general'},0);await api({action:'command',intent:category},session);await confirmed(category,session);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});await freshContext();await page.goto(PREVIEW+'/');await page.getByRole('heading',{name:'Rollback evidence',exact:true}).click();
 const modal=page.getByRole('heading',{name:'Rollback evidence',exact:true,level:2}).locator('xpath=ancestor::div[contains(@class,"max-w-xl")][1]');
 await page.route(PREVIEW+'/api/stage3',async route=>{
  try {
  const body=route.request().postDataJSON();const response=await route.fetch({headers:{...route.request().headers(),...previewHeaders()}});let data=await response.json();
  if(pendingId&&body.action==='status'&&body.id===pendingId&&data.result)data={...data,result:null,state:'accepted_pending'};
  await route.fulfill({response,json:data});
  } catch(error) {
    if(suspending||/already handled|closed|disposed/i.test(String(error))) report.route_lifecycle_cancellations=(report.route_lifecycle_cancellations||0)+1;
    else { report.route_errors=(report.route_errors||[]).concat(String(error.message).slice(0,250)); try { await route.abort(); } catch {} }
  }
 });
 const pendingRequest=page.waitForRequest(r=>{try{const b=r.postDataJSON();return b.action==='command'&&b.intent?.type==='stage4.product.create';}catch{return false;}});
 await modal.getByPlaceholder('Add product',{exact:true}).fill('Retained rollback product');await modal.getByRole('button',{name:'Add',exact:true}).click();const pending=(await pendingRequest).postDataJSON().intent;pendingId=pending.id;report.pending_operation_id=pendingId;
 await confirmed(pending,session);const committed=(await db.query('SELECT result FROM shopping.operations WHERE id=$1',[pendingId])).rows[0].result;assert.equal(committed.status,'committed');retainedHash=createHash('sha256').update(JSON.stringify(committed)).digest('hex');
 const queueBefore=await page.evaluate(({user,h})=>localStorage.getItem(`shopping-stage3-v2:${user}:${h}:stage4`),{user:session.user.id,h:homeHousehold});assert.ok(JSON.parse(queueBefore).some(p=>p.intent.id===pendingId&&!p.result));record('real app pending ID retained while PostgreSQL already committed',{operation_id:pendingId});
 suspending=true;await page.goto('about:blank');await page.unrouteAll({behavior:'wait'});report.browser_paused_during_rebuild=true;
 changed=true;flag('0');deploy('disabled');await selection('supabase');const fallbackResponse=await page.goto(PREVIEW+'/?rollback='+report.id);report.fallback_navigation={url:page.url().split('?')[0],status:fallbackResponse.status(),backend_hint:(await fallbackResponse.text()).match(/backend.{0,30}/g)};suspending=false;await page.getByRole('button',{name:'New category',exact:true}).waitFor();assert.equal(await page.locator('[data-backend="home"]').count(),0);
 const denied=await api({action:'command',intent:intent(homeHousehold,'stage4.product.create',{id:randomUUID(),category_id:category.payload.id,name:'must not execute'},0)},session);assert.equal(denied.status,404);
 const baselineName='Rollback Supabase '+report.id.slice(0,8);await page.getByRole('button',{name:'New category',exact:true}).click();await page.getByPlaceholder('Category name',{exact:true}).fill(baselineName);const baselineResponse=page.waitForResponse(r=>r.url().startsWith(dev.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/categories')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create',exact:true}).click();assert.ok((await baselineResponse).ok());await page.getByRole('heading',{name:baselineName,exact:true}).waitFor();
 const persisted=await fetch(dev.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/categories?household_id=eq.'+fixture+'&name=eq.'+encodeURIComponent(baselineName)+'&select=id,name',{headers:{apikey:dev.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token}});assert.ok(persisted.ok);assert.equal((await persisted.json()).length,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shopping.categories WHERE name=$1',[baselineName])).rows[0].n,0);
 await page.reload();await page.getByRole('heading',{name:baselineName,exact:true}).waitFor();await page.screenshot({path:folder+'/supabase-fallback.png',fullPage:true});record('flag off restores original Supabase Dev UI and actual write/reload with zero dual PostgreSQL write');
 const queueOff=await page.evaluate(({user,h})=>localStorage.getItem(`shopping-stage3-v2:${user}:${h}:stage4`),{user:session.user.id,h:homeHousehold});assert.ok(JSON.parse(queueOff).some(p=>p.intent.id===pendingId));assert.equal((await api({action:'status',id:pendingId,household_id:homeHousehold},session)).data.result.status,'committed');record('flag off preserves pending browser IDs and authenticated prior outcome retrieval');
 await page.goto('about:blank');flag('1');deploy('restored');changed=false;await selection('home');await page.goto(PREVIEW+'/?restored='+report.id);await page.locator('[data-backend="home"]').waitFor();await page.waitForFunction(({user,h,id})=>JSON.parse(localStorage.getItem(`shopping-stage3-v2:${user}:${h}:stage4`)||'[]').some(p=>p.intent.id===id&&p.result?.status==='committed'),{user:session.user.id,h:homeHousehold,id:pendingId});
 assert.equal(createHash('sha256').update(JSON.stringify((await db.query('SELECT result FROM shopping.operations WHERE id=$1',[pendingId])).rows[0].result)).digest('hex'),retainedHash);assert.deepEqual(production(project()),before);assert.equal(report.route_errors,undefined);record('re-enabled feature recovers identical committed outcome and production metadata unchanged');await page.screenshot({path:folder+'/home-restored.png',fullPage:true});report.status='PASS';
}catch(error){try{if(page&&page.url()!=='about:blank'){report.failure_location={url:page.url().split('?')[0],title:await page.title(),body:(await page.locator('body').innerText()).slice(0,2000)};await page.screenshot({path:folder+'/failure.png',fullPage:true});}}catch{}report.status='FAIL';report.error={name:error.name,message:String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]').slice(0,1500)};process.exitCode=1;}
finally{
 if(changed){try{flag('1');deploy('emergency_restored');report.emergency_restore=true;}catch{report.emergency_restore=false;}}
 try{await context?.close();}catch{}try{await browser?.close();}catch{}await db.end();writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,folder,checks:report.checks.length,error:report.error}));
}
