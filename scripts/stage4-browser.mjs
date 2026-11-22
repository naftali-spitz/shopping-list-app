import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
import { PREVIEW, previewHeaders, api, intent, confirmed } from './stage3-preview-check.mjs';
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const { chromium } = require('playwright-core');
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
const accounts = JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const { households } = JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report = {id: randomUUID(), at: new Date().toISOString(), sha: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), preview: PREVIEW, scope: 'real original Shopping List UI, protected feature Preview, real development identity and isolated PostgreSQL; no service faults', checks: [], operations: []};
const output = `docs/stage4/attempts/browser-${report.id}`;
mkdirSync(output,{recursive:true});
const db = new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const contexts=[];
let sharedHousehold = null;
const record=(name,evidence={})=>report.checks.push({name,status:'PASS',...evidence});
const escape = value => Array.from(value, char => ".*+?^${}()|[]".includes(char) || char.charCodeAt(0) === 92 ? String.fromCharCode(92) + char : char).join("");
async function login(index,{language='en',viewport={width:1440,height:1000}}={}) {
  const context=await browser.newContext({viewport,acceptDownloads:true});contexts.push(context);
  await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
  await context.addInitScript(({language,household,userId})=>{
    localStorage.setItem('futurecart.appLanguage',language);
    localStorage.setItem('futurecart.soundOn','false');
    if(household)localStorage.setItem(`futurecart.activeHouseholdId:home:${userId}`,household);
  },{language,household:index===2?households[1]:sharedHousehold,userId:accounts[index].id});
  const page=await context.newPage();page.setDefaultTimeout(90000);
  await page.goto(PREVIEW+'/');
  try { await page.getByLabel('Email',{exact:true}).waitFor({timeout:30000}); }
  catch {
    const image=`${output}/login-surface-${index}.png`;await page.screenshot({path:image,fullPage:true});
    report.login_surface={status:'missing experimental password form',screenshot:image,title:await page.title()};
    throw new Error('Experimental Email password form not present on feature alias; confirm deployed source and server feature guard.');
  }
  await page.getByLabel('Email',{exact:true}).fill(accounts[index].email);
  await page.getByLabel('Password',{exact:true}).fill(accounts[index].password);
  await page.getByRole('button',{name:language==='en'?'Sign in':'התחברות',exact:true}).click();
  await page.getByRole('button',{name:language==='en'?'Open menu and settings':'פתח תפריט והגדרות',exact:true}).waitFor();
  await page.getByRole('button',{name:language==='en'?'New category':'קטגוריה חדשה',exact:true}).waitFor();
  return {page,context,index};
}
async function operation(page,type,predicate,action) {
  const normalized=type.startsWith('stage4.')?type:'stage4.'+type;
  const requestPromise=page.waitForRequest(request=>{try{const body=request.postDataJSON();return request.url()===PREVIEW+'/api/stage3'&&body.action==='command'&&body.intent?.type===normalized&&predicate(body.intent);}catch{return false;}});
  const tap=Date.now();
  const [request]=await Promise.all([requestPromise,action()]);
  const intent=request.postDataJSON().intent;
  await page.waitForFunction(id=>Object.keys(localStorage).filter(k=>k.startsWith('shopping-stage3-v2:')).some(k=>{try{return JSON.parse(localStorage.getItem(k)).some(p=>p.intent.id===id&&p.result?.status==='committed');}catch{return false;}}),intent.id,{timeout:90000});
  const finished=Date.now();
  const row=(await db.query('SELECT result,operation_type FROM shopping.operations WHERE id=$1',[intent.id])).rows[0];
  assert.equal(row?.result.status,'committed');
  const counts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox',[intent.id])).rows[0];
  assert.deepEqual(counts,{ledger:1,outbox:1});
  const detail={id:intent.id,correlation_id:intent.correlation_id,type:normalized,household_id:intent.household_id,record_id:intent.payload.id,expected_version:intent.expected_version,ui_commit_confirmation_ms:finished-tap,counts};
  report.operations.push(detail);
  appendFileSync(`${output}/operations.jsonl`,JSON.stringify(detail)+"\n");
  return {intent,result:row.result,detail};
}
function categoryModal(page,name) {return page.getByRole('heading',{name,exact:true,level:2}).locator('..').locator('..').locator('..');}
async function createCategory(page,name,icon='Fruit & veg') {
  await page.getByRole('button',{name:'New category',exact:true}).click();
  await page.getByPlaceholder('Category name',{exact:true}).fill(name);
  await page.locator('button[aria-haspopup="listbox"]').click();
  if (!report.icon_picker_screenshot) { report.icon_picker_screenshot=await screenshot(page,'desktop-en-icon-dropdown'); }
  await page.getByRole('option',{name:icon,exact:true}).click();
  const op=await operation(page,'category.create',i=>i.payload.name===name,()=>page.getByRole('button',{name:'Create',exact:true}).click());
  await page.getByRole('heading',{name,exact:true}).waitFor();
  const row=(await db.query('SELECT name,icon,household_id,version::int,deleted_at FROM shopping.categories WHERE id=$1',[op.intent.payload.id])).rows[0];
  assert.equal(row.name,name);assert.equal(row.icon,'fruit');assert.equal(row.deleted_at,null);
  record('category created using original modal and localized icon dropdown, persisted in PostgreSQL',{operation_id:op.intent.id,record:row});
  return op.intent.payload.id;
}
async function addProduct(page,category,name) {
  await page.getByRole('heading',{name:category,exact:true}).click();
  const modal=categoryModal(page,category);
  await modal.getByPlaceholder('Add product',{exact:true}).fill(name);
  const op=await operation(page,'product.create',i=>i.payload.name===name,()=>modal.getByRole('button',{name:'Add',exact:true}).click());
  await modal.getByText(name,{exact:true}).waitFor();
  return op;
}
async function screenshot(page,name) {const path=`${output}/${name}.png`;await page.screenshot({path,fullPage:true});return path;}
async function assertProduct(id,expected) {const p=(await db.query('SELECT id,name,category_id,quantity::float8,checked,usage_count,version::int,deleted_at FROM shopping.products WHERE id=$1',[id])).rows[0];for(const [key,value]of Object.entries(expected))assert.deepEqual(p[key],value);return p;}
async function prepareIsolatedHousehold() {
  const { variables } = JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
  assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,'https://njomxqthjglqesxchlbm.supabase.co');
  const sessions=[];
  for (const account of accounts.slice(0,2)) {
    const response=await fetch(variables.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
    assert.equal(response.status,200);sessions.push(await response.json());
  }
  sharedHousehold=randomUUID();
  const execute=async(command,session)=>{
    const response=await api({action:'command',intent:command},session);assert.ok([200,202].includes(response.status));
    const result=response.data.result?response.data:await confirmed(command,session,120000);
    assert.equal(result.result.status,'committed');return result.result;
  };
  const creation=intent(sharedHousehold,'stage4.household.create',{name:'Browser parity '+report.id.slice(0,8)},0);
  await execute(creation,sessions[0]);
  const token=randomBytes(24).toString('hex');
  const invitation=intent(sharedHousehold,'stage4.invite.create',{id:randomUUID(),token},null);
  await execute(invitation,sessions[0]);
  const join=intent(accounts[1].id,'stage4.invite.accept',{token},null);
  await execute(join,sessions[1]);
  report.test_household={id:sharedHousehold,creation_operation:creation.id,invitation_operation:invitation.id,join_operation:join.id,scope:'isolated per-run household created and joined through real authenticated API; browser logins remain real password UI'};
  record('isolated household and two memberships established through verified lifecycle commands');
}
try {
  await prepareIsolatedHousehold();
  const a=await login(0),b=await login(1);record('two real password sessions open original root UI without credential reprovisioning');
  report.screenshots=[await screenshot(a.page,'desktop-en-baseline')];
  const suffix=report.id.slice(0,8),category=`Stage4 browser ${suffix}`,category2=`Stage4 destination ${suffix}`,name=`Stage4 product ${suffix}`;
  const categoryId=await createCategory(a.page,category);
  await b.page.getByRole('heading',{name:category,exact:true}).waitFor();record('second authenticated original UI receives category creation');
  const created=await addProduct(a.page,category,name),productId=created.intent.payload.id;
  await assertProduct(productId,{name,category_id:categoryId,quantity:1,checked:false,deleted_at:null});
  record('original category modal product create commits once',{operation_id:created.intent.id,product_id:productId});
  const modal=categoryModal(a.page,category);
  await operation(a.page,'product.update',i=>i.payload.id===productId&&i.payload.checked===true,()=>modal.getByRole('button',{name:new RegExp('^'+escape(name)+'\\s*\\d+x$')}).click());
  await assertProduct(productId,{checked:true});
  await modal.getByRole('button',{name:'Close',exact:true}).click();
  await operation(a.page,'product.update',i=>i.payload.id===productId&&i.payload.quantity===2,()=>a.page.getByRole('button',{name:'Increase '+name,exact:true}).filter({visible:true}).click());
  await assertProduct(productId,{quantity:2});record('original check and quantity drawer controls match authoritative PostgreSQL');
  report.screenshots.push(await screenshot(a.page,'desktop-en-selected-quantity'));
  await a.page.reload();await a.page.getByRole('heading',{name:category,exact:true}).waitFor();
  await a.page.getByRole('button',{name:'Increase '+name,exact:true}).filter({visible:true}).waitFor();record('refresh retains authoritative checked state and quantity');
  const destination=await createCategory(a.page,category2);
  await a.page.getByRole('heading',{name:category,exact:true}).click();
  const editModal=categoryModal(a.page,category);
  await editModal.getByRole('button',{name:'Edit product',exact:true}).click();
  const editor=a.page.getByRole('heading',{name:'עריכת מוצר',exact:true}).locator('..').locator('..');
  const renamed=name+' moved';await editor.locator('input').fill(renamed);await editor.locator('select').selectOption(destination);
  await operation(a.page,'product.update',i=>i.payload.id===productId&&i.payload.category_id===destination,()=>editor.getByRole('button',{name:'שמור',exact:true}).click());
  await assertProduct(productId,{name:renamed,category_id:destination});
  await editModal.getByRole('button',{name:'Close',exact:true}).click();
  await b.page.getByRole('heading',{name:category2,exact:true}).waitFor();
  await b.page.getByRole('heading',{name:category2,exact:true}).locator('..').getByText(renamed,{exact:true}).waitFor();
  record('product edit and category move persisted and synchronized');
  const downloadPromise=a.page.waitForEvent('download');
  await operation(a.page,'list.export',()=>true,()=>a.page.getByRole('button',{name:'Export document',exact:true}).filter({visible:true}).click());
  const download=await downloadPromise;const docx=`${output}/browser-export.docx`;await download.saveAs(docx);
  const document=JSON.parse(execFileSync('python3',['scripts/stage4-docx-inspect.py',docx],{encoding:'utf8'}));
  assert.ok(document.cell_text_in_xml_order.flat().includes(`☐ ${renamed} ×2`));
  const history=(await db.query("SELECT id,items,version::int FROM shopping.shopping_history WHERE household_id=$1 AND deleted_at IS NULL AND items @> $2::jsonb ORDER BY exported_at DESC LIMIT 1",[sharedHousehold,JSON.stringify([{id:productId}])])).rows[0];
  assert.ok(history);await assertProduct(productId,{checked:false,usage_count:1});
  record('actual browser DOCX download includes committed selection/quantity and PostgreSQL history',{history_id:history.id,document});
  await a.page.getByRole('button',{name:'Open history',exact:true}).click();
  // Newest history is first; this run just created it. Avoid matching hardcoded timestamp text.
  await a.page.getByRole('button',{name:'Delete history list',exact:true}).first().click();
  let rejectedIntent=null;
  const rejectDelete=async route=>{
    let body;try{body=route.request().postDataJSON();}catch{}
    if(!rejectedIntent && body?.action==='command' && body.intent?.type==='stage4.history.delete' && body.intent.payload.id===history.id) {
      rejectedIntent=body.intent;
      await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'request_rejected'})});
    } else await route.continue({headers:{...route.request().headers(),...previewHeaders()}});
  };
  await a.page.route(PREVIEW+'/api/stage3',rejectDelete);
  await a.page.getByRole('button',{name:'Delete',exact:true}).last().click();
  await a.page.waitForFunction(historyId=>Object.keys(localStorage).filter(k=>k.startsWith('shopping-stage3-v2:')).some(k=>{try{const rows=JSON.parse(localStorage.getItem(k));return Array.isArray(rows)&&rows.some(p=>p.intent.type==='stage4.history.delete'&&p.intent.payload.id===historyId&&p.result?.status==='request_rejected');}catch{return false;}}),history.id);
  assert.ok(rejectedIntent);
  const rejectedCounts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox',[rejectedIntent.id])).rows[0];
  assert.deepEqual(rejectedCounts,{ledger:0,outbox:0});
  assert.equal((await db.query('SELECT deleted_at FROM shopping.shopping_history WHERE id=$1',[history.id])).rows[0].deleted_at,null);
  await a.page.getByText('מחיקת רשימת ההיסטוריה נכשלה.',{exact:true}).waitFor();
  const rejectedScreenshot=await screenshot(a.page,'history-delete-rejected');
  report.rejected_history_delete={id:rejectedIntent.id,correlation_id:rejectedIntent.correlation_id,history_id:history.id,classification:'controlled HTTP400 before durable acceptance; no PostgreSQL execution',counts:rejectedCounts,screenshot:rejectedScreenshot};
  await a.page.unroute(PREVIEW+'/api/stage3',rejectDelete);
  await a.page.reload();await a.page.getByRole('heading',{name:category2,exact:true}).waitFor();
  await a.page.getByRole('button',{name:'Open history',exact:true}).click();
  await a.page.getByRole('button',{name:'Delete history list',exact:true}).first().waitFor();
  assert.equal((await db.query('SELECT deleted_at FROM shopping.shopping_history WHERE id=$1',[history.id])).rows[0].deleted_at,null);
  record('preacceptance rejected history deletion stays visible after refresh and has zero PostgreSQL effects',{operation_id:rejectedIntent.id,history_id:history.id});
  await a.page.getByRole('button',{name:'Delete history list',exact:true}).first().click();
  const successfulDelete=await operation(a.page,'history.delete',i=>i.payload.id===history.id,()=>a.page.getByRole('button',{name:'Delete',exact:true}).last().click());
  assert.notEqual(successfulDelete.intent.id,rejectedIntent.id);
  const deleted=(await db.query('SELECT deleted_at FROM shopping.shopping_history WHERE id=$1',[history.id])).rows[0];assert.ok(deleted.deleted_at);await assertProduct(productId,{usage_count:0});
  await a.page.reload();await a.page.getByRole('heading',{name:category2,exact:true}).waitFor();record('history delete commits tombstone and usage decrement, retained after refresh',{history_id:history.id});
  const c=await login(2);assert.equal(await c.page.getByRole('heading',{name:category,exact:true}).count(),0);assert.equal(await c.page.getByRole('heading',{name:category2,exact:true}).count(),0);record('third real account receives no other-household browser data');
  report.screenshots.push(await screenshot(a.page,'desktop-en-crud'));
  await a.page.getByRole('heading',{name:category2,exact:true}).click();
  const deleteModal=categoryModal(a.page,category2);
  await deleteModal.getByRole('button',{name:'Edit product',exact:true}).click();
  const deleteEditor=a.page.getByRole('heading',{name:'עריכת מוצר',exact:true}).locator('..').locator('..');
  await deleteEditor.getByRole('button',{name:'מחק מוצר',exact:true}).click();
  await operation(a.page,'product.delete',i=>i.payload.id===productId,()=>a.page.getByRole('button',{name:'Delete',exact:true}).last().click());
  assert.ok((await assertProduct(productId,{})).deleted_at);
  await b.page.getByRole('heading',{name:category2,exact:true}).locator('..').getByText(renamed,{exact:true}).waitFor({state:'detached'});
  record('product delete through existing confirmation persists PostgreSQL tombstone and disappears on second client');
  await deleteModal.getByRole('button',{name:'Close',exact:true}).click();
  const card=a.page.getByRole('heading',{name:category2,exact:true}).locator('..');
  await card.getByRole('button',{name:'Edit category',exact:true}).click();
  const editedCategory=category2+' edited';await a.page.getByPlaceholder('Category name',{exact:true}).fill(editedCategory);
  await operation(a.page,'category.update',i=>i.payload.id===destination&&i.payload.name===editedCategory,()=>a.page.getByRole('button',{name:'Save',exact:true}).click());
  await a.page.getByRole('heading',{name:editedCategory,exact:true}).waitFor();
  await b.page.getByRole('heading',{name:editedCategory,exact:true}).waitFor();
  await a.page.getByRole('heading',{name:editedCategory,exact:true}).locator('..').getByRole('button',{name:'Edit category',exact:true}).click();
  await a.page.getByRole('button',{name:'Delete category',exact:true}).click();
  await operation(a.page,'category.delete',i=>i.payload.id===destination,()=>a.page.getByRole('button',{name:'Delete',exact:true}).last().click());
  assert.ok((await db.query('SELECT deleted_at FROM shopping.categories WHERE id=$1',[destination])).rows[0].deleted_at);
  await a.page.reload();await a.page.getByRole('heading',{name:category,exact:true}).waitFor();
  assert.equal(await a.page.getByRole('heading',{name:editedCategory,exact:true}).count(),0);
  await b.page.getByRole('heading',{name:editedCategory,exact:true}).waitFor({state:'detached'});
  record('category rename and delete persist across refresh with tombstone and synchronize to second client');
  const mobile=await login(0,{language:'he',viewport:{width:390,height:844}});assert.equal(await mobile.page.locator('main').getAttribute('dir'),'rtl');
  report.screenshots.push(await screenshot(mobile.page,'mobile-he-light'));
  await mobile.page.getByRole('button',{name:'פתח תפריט והגדרות',exact:true}).click();
  await mobile.page.getByRole('button',{name:/העדפות/}).click();
  await mobile.page.getByRole('button',{name:/ערכת נושא/}).click();
  await mobile.page.getByRole('button',{name:'סגור',exact:true}).click();
  report.screenshots.push(await screenshot(mobile.page,'mobile-he-dark'));
  record('original mobile Hebrew RTL, profile collapsed preferences and light/dark screens captured');
  report.status='PASS';
} catch(error) {
  let message=String(error.message);for(const account of accounts)message=message.split(account.password).join('[REDACTED]');message=message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED]');
  report.status='FAIL';report.error={name:error.name,message:message.slice(0,2000)};process.exitCode=1;
} finally {
  for(const context of contexts)await context.close();await browser.close();await db.end();
  writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({id:report.id,status:report.status,checks:report.checks.length,report:`${output}/report.json`,error:report.error}));
}
