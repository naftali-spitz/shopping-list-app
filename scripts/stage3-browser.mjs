import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PREVIEW,previewHeaders,confirmed,api,intent } from './stage3-preview-check.mjs';
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const {chromium}=require('playwright-core');
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual Chrome browsers on protected feature Vercel Preview; real Auth, broker, Debian PostgreSQL and HTTPS callbacks',checks:[]};
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const contexts=[];
const lastSnapshots=new WeakMap();
const record=name=>report.checks.push({name,status:'PASS'});
async function login(index) {
  const context=await browser.newContext();contexts.push(context);
  await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
  const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('response',async response=>{try{if(response.url().endsWith('/api/stage3')){const data=await response.json();if(data.result?.status==='snapshot')lastSnapshots.set(page,data);}}catch{}});
  await page.goto(PREVIEW+'/stage3');
  await page.getByLabel('Email',{exact:true}).fill(accounts[index].email);
  await page.getByLabel('Password',{exact:true}).fill(accounts[index].password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-testid="revision"]')?.textContent!=='Loading');
  return {page,context};
}
async function state(page,id,wanted) {await page.locator(`[data-operation-id="${id}"][data-state="${wanted}"]`).waitFor();}
async function createProduct(page,name) {
  await page.getByLabel('Product name',{exact:true}).fill(name);
  const accepted=page.waitForResponse(r=>{if(!r.url().endsWith('/api/stage3')||r.request().method()!=='POST')return false;try{const b=r.request().postDataJSON();return b.action==='command'&&b.intent.type==='product.create'&&b.intent.payload.name===name&&r.status()===202;}catch{return false;}});
  const started=Date.now();await page.getByRole('button',{name:'Add product',exact:true}).click();
  await page.getByText(name,{exact:true}).waitFor();
  const response=await accepted;return {intent:response.request().postDataJSON().intent,started};
}
try {
  const a=await login(0),b=await login(1);record('two independent real browser sessions in one household');
  const name='Browser proof '+report.id.slice(0,8);
  const created=await createProduct(a.page,name);report.operation_id=created.intent.id;report.correlation_id=created.intent.correlation_id;
  await a.context.setOffline(true);
    const currentSession=await a.page.evaluate(()=>JSON.parse(localStorage.getItem('sb-njomxqthjglqesxchlbm-auth-token')));
    const authoritative=await confirmed(created.intent,currentSession);assert.equal(authoritative.result.status,'committed');
  assert.notEqual(await a.page.locator(`[data-operation-id="${created.intent.id}"]`).getAttribute('data-state'),'Saved');
  record('browser offline while PostgreSQL commits: optimistic change remains pending');
  await a.context.setOffline(false);await state(a.page,created.intent.id,'Saved');
  report.browser_confirmation_ms=Date.now()-created.started;record('browser reconnect retrieves authoritative commit and marks Saved');
  await b.page.getByText(name,{exact:true}).waitFor();record('second authorized device synchronizes the same product');
  assert.equal(await b.page.getByText(name,{exact:true}).count(),1);record('repeated result polls do not duplicate product effects');
  const refreshed=await createProduct(a.page,'Refresh proof '+report.id.slice(0,8));
  await a.page.reload();await state(a.page,refreshed.intent.id,'Saved');record('refresh while pending recovers the same persisted operation ID');
  const productId=created.intent.payload.id;
  const row=p=>p.locator(`[data-product-id="${productId}"]`);
  await b.page.waitForFunction(id=>document.querySelector(`[data-product-id="${id}"] [data-testid="quantity"]`)?.textContent==='1',productId);
  const staleSnapshot=JSON.parse(JSON.stringify(lastSnapshots.get(b.page)));
  await Promise.all([a.page.getByRole('button',{name:'Increase '+name,exact:true}).click(),b.page.getByRole('button',{name:'Increase '+name,exact:true}).click()]);
  await a.page.waitForFunction(()=>document.querySelector('[data-state="Conflict requiring reconciliation"]')||Array.from(document.querySelectorAll('[data-state="Saved"]')).length>=3);
  await b.page.waitForFunction(()=>document.querySelector('[data-state="Conflict requiring reconciliation"]')||document.querySelector('[data-state="Saved"]'));
  const until=Date.now()+60000;
  while(Date.now()<until) {
    const states=await Promise.all([a.page.locator('[data-state="Conflict requiring reconciliation"]').count(),b.page.locator('[data-state="Conflict requiring reconciliation"]').count()]);
    if(states[0]+states[1]===1)break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.equal(await a.page.locator('[data-state="Conflict requiring reconciliation"]').count()+await b.page.locator('[data-state="Conflict requiring reconciliation"]').count(),1);
  await a.page.waitForFunction(id=>document.querySelector(`[data-product-id="${id}"] [data-testid="quantity"]`)?.textContent==='2',productId);
  await b.page.waitForFunction(id=>document.querySelector(`[data-product-id="${id}"] [data-testid="quantity"]`)?.textContent==='2',productId);
  assert.equal(await row(a.page).count(),1);record('concurrent quantity changes produce one commit, one visible conflict; both devices converge');
  const revisionBefore=Number(await b.page.getByTestId('revision').textContent());let injected=false;
  await b.page.route(PREVIEW+'/api/stage3',async route=>{
    const response=await route.fetch({headers:{...route.request().headers(),...previewHeaders()}});
    const data=await response.json();
    if(!injected&&data.result?.status==='snapshot'){injected=true;await route.fulfill({response,json:staleSnapshot});}
    else await route.fulfill({response});
  });
  const injectDeadline=Date.now()+30000;while(!injected&&Date.now()<injectDeadline)await new Promise(resolve=>setTimeout(resolve,200));
  assert.ok(injected);await new Promise(resolve=>setTimeout(resolve,500));
  assert.ok(Number(await b.page.getByTestId('revision').textContent())>=revisionBefore);
  assert.equal(await row(b.page).getByTestId('quantity').textContent(),'2');
  record('controlled out-of-order older snapshot cannot overwrite newer household revision');
  await b.page.unroute(PREVIEW+'/api/stage3');
  await b.page.reload();await b.page.getByText(name,{exact:true}).waitFor();record('refresh retrieves authoritative state after conflict');
  const selectedHousehold=await b.page.getByLabel('Household',{exact:true}).inputValue();
  const browserSession=await b.page.evaluate(()=>JSON.parse(localStorage.getItem('sb-njomxqthjglqesxchlbm-auth-token')));
  let paused=false;
  try {
    execFileSync('python3',['scripts/stage3-service.py','stop'],{stdio:['ignore','pipe','pipe']});paused=true;
    const expiredIntent=intent(selectedHousehold,'category.create',{id:randomUUID(),name:'Expired browser proof',icon:'general'},0);
    expiredIntent.expires_ms=expiredIntent.issued_ms+15000;
    assert.equal((await api({action:'command',intent:expiredIntent},browserSession)).status,202);
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiredIntent.expires_ms-Date.now()+1500)));
    await b.page.evaluate(({key,intent})=>localStorage.setItem(key,JSON.stringify([{intent,state:'Offline/pending'}])),{key:`shopping-stage3-v2:${accounts[1].id}:${selectedHousehold}`,intent:expiredIntent});
    await b.page.reload();await state(b.page,expiredIntent.id,'Conflict requiring reconciliation');
    const reconciliationAccepted=b.page.waitForResponse(r=>{try{return r.url().endsWith('/api/stage3')&&r.request().postDataJSON().intent?.type==='operation.status'&&r.status()===202;}catch{return false;}});
    await b.page.locator(`[data-operation-id="${expiredIntent.id}"]`).getByRole('button',{name:'Reconcile',exact:true}).click();
    await reconciliationAccepted;
    execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:['ignore','pipe','pipe']});paused=false;
    await state(b.page,expiredIntent.id,'Failed');report.expired_operation_id=expiredIntent.id;report.expired_record_id=expiredIntent.payload.id;
    record('controlled listener pause: expired unexecuted intent is safely reconciled and shown Failed');
  }finally{if(paused)execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:['ignore','pipe','pipe']});}
  const c=await login(2);assert.equal(await c.page.getByText(name,{exact:true}).count(),0);record('other-household browser receives no shared-household product');
  await a.page.screenshot({path:`docs/stage3/attempts/browser-${report.id}.png`,fullPage:true});
  report.status='PASS';
}catch(error){let message=error.message;for(const a of accounts)message=message.split(a.password).join('[REDACTED]');message=message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED]');report.status='FAIL';report.error={type:error.name,message:message.slice(0,1600)};process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();writeFileSync(`docs/stage3/attempts/browser-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
