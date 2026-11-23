// Actual original-app household journeys. No fixture account resets or service faults.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
import {PREVIEW,previewHeaders} from './stage3-preview-check.mjs';
import {getDefaultHouseholdTemplate} from '../integration/stage4/template.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const {chromium}=require('playwright-core');
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const report={id:randomUUID(),at:new Date().toISOString(),harness_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),preview:PREVIEW,scope:'actual original app household controls through protected Preview, real provider identity, flespi and isolated PostgreSQL; no service faults',checks:[],operations:[]};
const deployment=JSON.parse(execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',['inspect',PREVIEW,'--json','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const source=JSON.parse(execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',['api',`/v13/deployments/${deployment.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD&withGitRepoInfo=true`,'--method','GET','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(source.projectId,'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');
assert.notEqual(source.target,'production');
assert.equal(source.gitSource?.ref,'feature/flespi-home-backend');
if(process.env.STAGE4_EXPECT_SHA) assert.equal(source.gitSource?.sha,process.env.STAGE4_EXPECT_SHA);
report.deployment={id:deployment.id,git_sha:source.gitSource?.sha??source.meta?.githubCommitSha,git_ref:source.gitSource?.ref,url:deployment.url,target:deployment.target,ready_state:deployment.readyState};
const out=`docs/stage4/attempts/household-browser-${report.id}`;mkdirSync(out,{recursive:true});
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const contexts=[];const pages=[];
const check=(name,evidence={})=>{const item={name,status:'PASS',...evidence};report.checks.push(item);appendFileSync(out+'/checks.jsonl',JSON.stringify(item)+'\n');writeFileSync(out+'/in-progress.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({progress:name}));};
async function login(index) {
  const context=await browser.newContext({viewport:{width:1365,height:1000},permissions:['clipboard-read','clipboard-write']});contexts.push(context);
  await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
  await context.addInitScript(()=>{localStorage.setItem('futurecart.appLanguage','en');localStorage.setItem('futurecart.soundOn','false');});
  const page=await context.newPage();pages.push(page);page.setDefaultTimeout(90000);await page.goto(PREVIEW+'/');
  await page.getByLabel('Email',{exact:true}).fill(accounts[index].email);await page.getByLabel('Password',{exact:true}).fill(accounts[index].password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Open menu and settings',exact:true}).waitFor();
  return {page,context,index};
}
async function profile(page) {
  await page.getByRole('button',{name:'Open menu and settings',exact:true}).click();
  const modal=page.getByRole('heading',{name:'Menu',exact:true}).locator('xpath=ancestor::div[contains(@class,"max-w-md")][1]');
  await modal.waitFor();
  // Expansion is a persistent preference of the mounted profile modal. Reopen
  // the section only when collapsed; toggling unconditionally closes it.
  const create=modal.getByRole('button',{name:/^New household/});
  if(!await create.isVisible()) await modal.getByRole('button',{name:/^Current household/}).click();
  await create.waitFor();
  return modal;
}
async function operation(page,type,action,status='committed') {
  const pending=page.waitForRequest(request=>{try{const b=request.postDataJSON();return request.url()===PREVIEW+'/api/stage3'&&b.action==='command'&&b.intent?.type==='stage4.'+type;}catch{return false;}});
  await action();const request=await pending;const intent=request.postDataJSON().intent;
  await page.waitForFunction(({id,status})=>Object.keys(localStorage).filter(k=>k.startsWith('shopping-stage3-v2:')&&k.endsWith(':stage4')).some(k=>{try{return JSON.parse(localStorage.getItem(k)).some(p=>p.intent.id===id&&p.result?.status===status);}catch{return false;}}),{id:intent.id,status});
  const row=(await db.query('SELECT result FROM shopping.operations WHERE id=$1',[intent.id])).rows[0];assert.equal(row?.result.status,status);
  const counts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox',[intent.id])).rows[0];assert.deepEqual(counts,{ledger:1,outbox:1});
  report.operations.push({operation_id:intent.id,correlation_id:intent.correlation_id,type,scope:intent.household_id,status,counts});
  return {intent,result:row.result};
}
async function createHousehold(page,name,language) {
  await profile(page);await page.getByRole('button',{name:/^New household/}).click();
  const form=page.getByRole('heading',{name:'Create household',exact:true}).locator('xpath=ancestor::form');
  await form.getByLabel('Household name',{exact:true}).fill(name);await form.getByRole('button',{name:language==='he'?'עברית':'English',exact:true}).click();
  const seeded=page.waitForRequest(request=>{try{return request.url()===PREVIEW+'/api/stage3'&&request.postDataJSON().intent?.type==='stage4.household.seed';}catch{return false;}});
  const op=await operation(page,'household.create',()=>form.getByRole('button',{name:'Create',exact:true}).click());
  const seedIntent=(await seeded).postDataJSON().intent;
  await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.endsWith(':stage4')).some(k=>{try{return JSON.parse(localStorage.getItem(k)).some(p=>p.intent.id===id&&p.result?.status==='committed');}catch{return false;}}),seedIntent.id);
  const h=op.result.data.record.id,template=getDefaultHouseholdTemplate(language);
  await page.getByRole('heading',{name:template[0].name,exact:true}).waitFor();
  const cats=(await db.query('SELECT id,name FROM shopping.categories WHERE household_id=$1 AND deleted_at IS NULL ORDER BY created_at,id',[h])).rows;
  assert.deepEqual(cats.map(c=>c.name),template.map(c=>c.name));
  const products=(await db.query('SELECT count(*)::int AS count FROM shopping.products WHERE household_id=$1 AND deleted_at IS NULL',[h])).rows[0].count;assert.equal(products,27);
  check(`${language} starter list created through existing modal; PostgreSQL preserves5categories/27products and category order`,{household_id:h,create_operation:op.intent.id,seed_operation:seedIntent.id});
  return h;
}
async function browserCommand(page,household,type,payload={},version=null) {
  return page.evaluate(async ({household,type,payload,version})=>{
    const session=JSON.parse(localStorage.getItem('sb-njomxqthjglqesxchlbm-auth-token'));const now=Date.now();
    const intent={id:crypto.randomUUID(),household_id:household,type:'stage4.'+type,payload,expected_version:version,correlation_id:crypto.randomUUID(),issued_ms:now,expires_ms:now+300000};
    const api=async body=>{const r=await fetch('/api/stage3',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});return {http:r.status,body:await r.json()};};
    let response=await api({action:'command',intent});
    for(let i=0;i<80&&response.http<400&&!response.body.result;i++){await new Promise(r=>setTimeout(r,600));response=await api({action:'status',household_id:household,id:intent.id});}
    return {id:intent.id,correlation_id:intent.correlation_id,...response};
  },{household,type,payload,version});
}
try {
  assert.equal((await db.query('SHOW port')).rows[0].port,'55439');
  const a=await login(0),b=await login(1),c=await login(2);check('three existing password identities log into original application without provisioning');
  const suffix=report.id.slice(0,8),englishName='Stage4 browser home '+suffix;
  const h=await createHousehold(a.page,englishName,'en');report.household_id=h;
  let modal=await profile(a.page);await modal.getByLabel('List name',{exact:true}).fill(englishName+' renamed');
  const rename=await operation(a.page,'household.rename',()=>modal.getByRole('button',{name:'Save name',exact:true}).click());
  await a.page.getByRole('button',{name:'Open menu and settings',exact:true}).waitFor();
  assert.equal((await db.query('SELECT name FROM shopping.households WHERE id=$1',[h])).rows[0].name,englishName+' renamed');check('owner rename through profile is persisted and survives automatic reload',{operation_id:rename.intent.id});
  modal=await profile(a.page);await modal.getByRole('heading',{name:'List members',exact:true}).waitFor();
  await modal.getByText(accounts[0].id.slice(0,8)+' · owner',{exact:true}).waitFor();
  let inviteToken;
  const invite=await operation(a.page,'invite.create',()=>modal.getByRole('button',{name:/^Invite/}).click());
  const copied=await a.page.evaluate(()=>navigator.clipboard.readText());assert.equal(new URL(copied).origin,PREVIEW);inviteToken=new URL(copied).searchParams.get('invite');assert.match(inviteToken,/^[a-f0-9]{48}$/);
  assert.equal(invite.result.data.record.token,inviteToken);
  report.invitation={id:invite.intent.payload.id,token_sha256:createHash('sha256').update(inviteToken).digest('hex'),expires_at:invite.result.data.record.expiresAt};
  const join=await operation(b.page,'invite.accept',()=>b.page.goto(copied));
  assert.equal(join.result.data.record.id,h);
  await b.page.getByRole('heading',{name:'Dairy',exact:true}).waitFor();
  let members=(await db.query('SELECT user_id,role,active FROM shopping.household_members WHERE household_id=$1 ORDER BY role,user_id',[h])).rows;assert.equal(members.length,2);assert.ok(members.every(m=>m.active));
  check('member invitation copied in original profile and accepted by second authenticated browser; membership verified in PostgreSQL',{invite_id:invite.intent.payload.id,join_operation:join.intent.id});
  const duplicate=await operation(b.page,'invite.accept',()=>b.page.goto(copied));assert.equal(duplicate.result.data.record.id,h);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM shopping.household_members WHERE household_id=$1 AND user_id=$2',[h,accounts[1].id])).rows[0].count,1);check('duplicate reusable invitation acceptance retains exactly one membership',{operation_id:duplicate.intent.id});
  const invalid=await operation(c.page,'invite.accept',()=>c.page.goto(PREVIEW+'/?invite='+'0'.repeat(48)),'not_found');
  check('invalid invitation through original app rejects enrollment',{operation_id:invalid.intent.id});
  await db.query("UPDATE shopping.household_invites SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1 AND household_id=$2",[invite.intent.payload.id,h]);
  const expired=await operation(c.page,'invite.accept',()=>c.page.goto(copied),'not_found');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM shopping.household_members WHERE household_id=$1 AND user_id=$2',[h,accounts[2].id])).rows[0].count,0);
  check('controlled expiry of this run invitation is rejected by original app with no membership effect',{operation_id:expired.intent.id});
  await a.page.reload();modal=await profile(a.page);
  await modal.getByText(accounts[1].id.slice(0,8)+' · member',{exact:true}).waitFor();
  await a.page.screenshot({path:out+'/owner-members-en.png',fullPage:true});check('owner profile lists both connected principal identities');
  const foreign=await browserCommand(c.page,h,'snapshot');assert.equal(foreign.body.result?.status,'forbidden');assert.equal(await c.page.getByRole('heading',{name:'Dairy',exact:true}).count(),0);
  check('third authenticated browser cannot retrieve new foreign household',{operation_id:foreign.id,status:foreign.body.result.status});
  const removal=await operation(a.page,'membership.remove',()=>modal.getByRole('button',{name:'Remove member',exact:true}).click());
  assert.equal((await db.query('SELECT active FROM shopping.household_members WHERE household_id=$1 AND user_id=$2',[h,accounts[1].id])).rows[0].active,false);
  const denied=await browserCommand(b.page,h,'snapshot');assert.equal(denied.body.result?.status,'forbidden');check('owner removal persists and removed browser new snapshot is denied',{remove_operation:removal.intent.id,denied_operation:denied.id});
  await b.page.reload();await b.page.getByRole('button',{name:'Open menu and settings',exact:true}).waitFor();assert.equal(await b.page.getByRole('heading',{name:'Dairy',exact:true}).count(),0);check('removed member refresh discovers only authorized remaining lists');
  await modal.getByRole('button',{name:'Close',exact:true}).click();
  const he=await createHousehold(a.page,'בית בדיקה '+suffix,'he');report.hebrew_household_id=he;
  await a.page.screenshot({path:out+'/hebrew-starter-categories.png',fullPage:true});
  await a.page.reload();await a.page.getByRole('heading',{name:'מוצרי חלב',exact:true}).waitFor();check('Hebrew starter list survives refresh');
  modal=await profile(a.page);await modal.getByRole('button',{name:new RegExp('^'+englishName+' renamed')}).click();
  await a.page.getByRole('button',{name:'Open menu and settings',exact:true}).waitFor();await a.page.getByRole('heading',{name:'Dairy',exact:true}).waitFor();check('existing household switch control retrieves selected authoritative list');
  if(process.argv.includes('--include-logout')) {
    const logoutMenu=await profile(c.page);
    await logoutMenu.getByRole('button',{name:'Sign out',exact:true}).click();
    await c.page.getByLabel('Email',{exact:true}).waitFor();
    assert.equal(await c.page.getByRole('button',{name:'New category',exact:true}).count(),0);
    await c.page.screenshot({path:out+'/logged-out.png',fullPage:true});
    check('original app logout clears rendered household authority and returns to password/Google login');
  } else report.deferred_logout='Global logout intentionally left for final sequential test: other acceptance browsers may share existing test accounts.';
  report.status='PASS';
} catch(error) {
  for(let i=0;i<pages.length;i++){try{await pages[i].screenshot({path:out+`/failure-page-${i}.png`,fullPage:true});const text=await pages[i].locator('body').innerText();writeFileSync(out+`/failure-page-${i}.txt`,text.replace(/[a-f0-9]{48}/g,'[redacted token]'));}catch{}}
  report.status='FAIL';report.error={type:error.name,message:error.name==='AssertionError'?error.message:'Browser household assertion or selector failed; credential-bearing diagnostics omitted'};
  let stack=String(error.stack).replace(/https:\/\/[^\s?]+\?invite=[a-f0-9]+/g,'[redacted invitation URL]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted JWT]');
  for(const account of accounts)stack=stack.split(account.password).join('[redacted password]');
  writeFileSync(out+'/failure-location.txt',stack);process.exitCode=1;
} finally {
  writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  await Promise.allSettled(contexts.map(context=>context.close()));await browser.close().catch(()=>{});await db.end();
  console.log(JSON.stringify({status:report.status,id:report.id,checks:report.checks.length,evidence:out+'/report.json'}));
}
