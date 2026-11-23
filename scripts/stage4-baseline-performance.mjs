// Actual existing Supabase Dev UI benchmark. No Debian/service/feature mutations.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const {chromium}=require('playwright-core');
const TARGET='https://shopping-list-app-git-develop-0012ab-5576s-projects.vercel.app';
const AUTH='https://njomxqthjglqesxchlbm.supabase.co';
const {variables}=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,AUTH);
const key=variables.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
let session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const env=readFileSync('.stage0-runtime/audit-develop.env','utf8');
const raw=env.split('\n').find(l=>l.startsWith('VERCEL_OIDC_TOKEN='))?.split('=').slice(1).join('=');assert.ok(raw);
const oidc=raw.startsWith('"')?JSON.parse(raw):raw;
const report={id:randomUUID(),at:new Date().toISOString(),target:TARGET,source_sha:execFileSync('git',['rev-parse','origin/develop'],{encoding:'utf8'}).trim(),scope:'original Supabase Dev app at develop Preview, actual browser clicks and authoritative development PostgREST reads; no Debian/feature writes',samples:[],checks:[]};
const folder=`docs/stage4/attempts/baseline-performance-${report.id}`;mkdirSync(folder,{recursive:true});
let browser,context;
const record=(name,evidence={})=>{report.checks.push({name,status:'PASS',...evidence});console.log(JSON.stringify({event:'baseline_check',name}));};
async function rest(path){const response=await fetch(AUTH+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+session.access_token},redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok(response.ok,`Dev PostgREST HTTP ${response.status}`);return response.json();}
async function product(name){const rows=await rest('products?select=id,name,checked,quantity,category_id&name=eq.'+encodeURIComponent(name));assert.equal(rows.length,1);return rows[0];}
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(fn,timeout=20000){const until=Date.now()+timeout;let error;while(Date.now()<until){try{return await fn();}catch(e){error=e;await wait(150);}}throw error;}
function categoryModal(page,name){return page.getByRole('heading',{name,exact:true}).locator('xpath=ancestor::div[contains(@class,"max-w-xl")][1]');}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function measure(page,kind,button,expected,responseFilter){
  const responsePromise=page.waitForResponse(response=>response.url().startsWith(AUTH+'/rest/v1/products')&&responseFilter(response)).then(response=>({response,at:Date.now()}));
  const tap=Date.now();
  const visiblePromise=(async()=>{await button.click();await expected();return Date.now();})();
  const [{response,at:confirmed},optimistic]=await Promise.all([responsePromise,visiblePromise]);assert.ok(response.ok(),`Supabase ${kind} HTTP ${response.status()}`);
  const sample={kind,context:'warm-existing-browser-context',tap_to_visible_feedback_ms:optimistic-tap,tap_to_database_http_ack_ms:confirmed-tap,http_status:response.status()};
  report.samples.push(sample);appendFileSync(`${folder}/samples.jsonl`,JSON.stringify(sample)+'\n');return sample;
}
try{
  // Reuse an already-provisioned account/session. If expired, reauthenticate the
  // same credentials in memory; no password/reset/account creation occurs.
  const user=await fetch(AUTH+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(10000)});
  if(!user.ok){const response=await fetch(AUTH+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:accounts[0].email,password:accounts[0].password}),signal:AbortSignal.timeout(10000)});assert.ok(response.ok());session=await response.json();}
  assert.equal(session.user.id,accounts[0].id);
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.route(TARGET+'/**',route=>route.continue({headers:{...route.request().headers(),'x-vercel-trusted-oidc-idp-token':oidc}}));
  await context.addInitScript(({session,household})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(session));localStorage.setItem('futurecart.activeHouseholdId',household);localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');},{session,household:households[0]});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const firstStart=Date.now();const initial=await page.goto(TARGET+'/');assert.equal(initial.status(),200);
  await page.getByRole('button',{name:'New category',exact:true}).waitFor();
  report.load_samples=[{kind:'first-browser-context-load',navigation_to_app_ready_ms:Date.now()-firstStart,cold_function_instance_known:false}];
  record('authenticated original develop UI uses existing Dev identity/session');
  await page.screenshot({path:`${folder}/desktop-baseline.png`,fullPage:true});
  const category=`Stage4 baseline ${report.id.slice(0,8)}`;
  await page.getByRole('button',{name:'New category',exact:true}).click();await page.getByPlaceholder('Category name',{exact:true}).fill(category);
  const catResponse=page.waitForResponse(r=>r.url().startsWith(AUTH+'/rest/v1/categories')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create',exact:true}).click();assert.ok((await catResponse).ok());
  await page.getByRole('heading',{name:category,exact:true}).click();
  const modal=categoryModal(page,category);
  const names=[];
  for(let i=0;i<10;i++){
    const name=`Baseline ${report.id.slice(0,8)} ${i+1}`;names.push(name);
    await modal.getByPlaceholder('Add product',{exact:true}).fill(name);
    const sample=await measure(page,'product.create',modal.getByRole('button',{name:'Add',exact:true}),()=>modal.getByText(name,{exact:true}).waitFor(),r=>r.request().method()==='POST'&&r.request().postDataJSON().name===name);
    const p=await eventually(async()=>{const p=await product(name);assert.equal(p.checked,false);return p;});sample.record_id=p.id;
  }
  record('10 actual original UI product creations persisted in Supabase Dev',{category,products:names.length});
  const name=names[0],p=await product(name);report.product_id=p.id;
  for(let i=0;i<20;i++){
    const checked=i%2===0;
    const button=modal.getByRole('button',{name:new RegExp('^'+escape(name)+'\\s*\\d+x$')});
    await measure(page,checked?'product.check':'product.uncheck',button,()=>page.waitForFunction(({name,checked})=>{const spans=[...document.querySelectorAll('span')].filter(s=>s.textContent===name);const span=spans.find(s=>s.closest('button')&&s.closest('button').querySelector('.rounded-full'));if(!span)return false;return span.closest('button').parentElement.className.includes('border-cyan-400')===checked;},{name,checked}),r=>r.request().method()==='PATCH'&&r.url().includes(p.id)&&r.request().postDataJSON().checked===checked);
    await eventually(async()=>assert.equal((await product(name)).checked,checked));
    // Leave time for the real baseline pending-click guard to clear and its
    // authoritative realtime refresh to settle; this is not benchmark latency.
    await wait(100);
  }
  record('10 check and 10 uncheck real UI operations persisted; no retries counted as extra taps');
  await measure(page,'product.check',modal.getByRole('button',{name:new RegExp('^'+escape(name)+'\\s*\\d+x$')}),()=>Promise.resolve(),r=>r.request().method()==='PATCH'&&r.url().includes(p.id)&&r.request().postDataJSON().checked===true);
  await modal.getByRole('button',{name:'Close',exact:true}).click();
  const increase=page.getByRole('button',{name:'Increase '+name,exact:true}).filter({visible:true});
  for(let i=0;i<10;i++){
    const quantity=i+2;
    await wait(750); // Allow original full-list realtime reload to settle between paced benchmark edits.
    await measure(page,'product.quantity',increase,()=>page.waitForFunction(({name,quantity})=>{const b=document.querySelector(`button[aria-label="Increase ${name}"]`);return b?.parentElement.querySelector('span')?.textContent===String(quantity);},{name,quantity}),r=>r.request().method()==='PATCH'&&r.url().includes(p.id)&&r.request().postDataJSON().quantity===quantity);
    await eventually(async()=>assert.equal(Number((await product(name)).quantity),quantity));
  }
  record('10 quantity edits match persisted Supabase Dev values');
  const reloadStart=Date.now();await page.reload();await page.getByRole('heading',{name:category,exact:true}).waitFor();await increase.waitFor();
  assert.equal(Number((await product(name)).quantity),11);
  report.load_samples.push({kind:'warm-browser-reload',navigation_to_app_ready_ms:Date.now()-reloadStart,cold_function_instance_known:false});
  record('browser refresh retrieves checked/quantity state from original backend');
  await page.screenshot({path:`${folder}/desktop-after.png`,fullPage:true});
  report.summary={};
  for(const kind of [...new Set(report.samples.map(s=>s.kind))]){const samples=report.samples.filter(s=>s.kind===kind),median=field=>{const sorted=samples.map(s=>s[field]).sort((a,b)=>a-b);return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;};report.summary[kind]={n:samples.length,median_visible_feedback_ms:median('tap_to_visible_feedback_ms'),median_database_http_ack_ms:median('tap_to_database_http_ack_ms'),tail_percentiles:'not reported: small exploratory cohort'};}
  report.status='PASS';
}catch(error){let message=String(error.message);for(const a of accounts)message=message.split(a.password).join('[REDACTED]');message=message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED]');report.status='FAIL';report.error={name:error.name,message:message.slice(0,1800)};process.exitCode=1;}
finally{if(context)await context.close();if(browser)await browser.close();writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({id:report.id,status:report.status,checks:report.checks.length,summary:report.summary,report:`${folder}/report.json`,error:report.error}));}
