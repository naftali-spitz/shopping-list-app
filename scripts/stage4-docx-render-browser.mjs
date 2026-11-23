// Focused larger real-app export. SQL creates only this run's labelled synthetic
// fixture; browser export itself uses normal authenticated durable commands.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from '../backend/node_modules/pg/lib/index.js';
import {PREVIEW,previewHeaders,api,intent,confirmed} from './stage3-preview-check.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:'pipe'});
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');const{chromium}=require('playwright-core');
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const report={id:randomUUID(),at:new Date().toISOString(),harness_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'actual original UI snapshot of300synthetic PostgreSQL products and80checked Hebrew DOCX export; setup fixture is SQL, not claimed browser CRUD',checks:[]};
const out=`docs/stage4/attempts/docx-browser-${report.id}`;mkdirSync(out,{recursive:true});
const deployment=JSON.parse(execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',['inspect',PREVIEW,'--json','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const source=JSON.parse(execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',['api',`/v13/deployments/${deployment.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD`,'--method','GET','--scope','0012ab-5576s-projects','--non-interactive'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(source.projectId,'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');assert.notEqual(source.target,'production');
report.deployment={id:deployment.id,sha:source.gitSource?.sha??source.meta?.githubCommitSha,url:deployment.url};
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
let browser,context;
const check=(name,evidence={})=>report.checks.push({name,status:'PASS',...evidence});
try{
 const h=randomUUID(),category=randomUUID();report.household_id=h;
 const create=intent(h,'stage4.household.create',{name:'DOCX large fixture '+report.id.slice(0,8)},0);
 assert.equal((await api({action:'command',intent:create},session)).status,202);assert.equal((await confirmed(create,session)).result.status,'committed');
 const cat=intent(h,'stage4.category.create',{id:category,name:'קניות לבדיקה',icon:'general'},0);
 assert.equal((await api({action:'command',intent:cat},session)).status,202);assert.equal((await confirmed(cat,session)).result.status,'committed');
 const owner=(await db.query('SELECT current_database() AS database,inet_server_port() AS port,(SELECT role FROM shopping.household_members WHERE household_id=$1 AND user_id=$2 AND active) AS role',[h,session.user.id])).rows[0];assert.deepEqual(owner,{database:'shopping_stage0',port:55439,role:'owner'});
 const prefix=randomUUID().slice(0,24);const fixture=Array.from({length:300},(_,i)=>({id:prefix+(i+1).toString(16).padStart(12,'0'),name:'מוצר בדיקה '+String(i+1).padStart(3,'0'),checked:i<80,quantity:i%10===0?3:1,display_order:(i+1)*100}));
 await db.query('BEGIN');
 try{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[h]);
  await db.query('INSERT INTO shopping.products(id,household_id,category_id,name,checked,quantity,display_order) SELECT p.id,$1::uuid,$2::uuid,p.name,p.checked,p.quantity,p.display_order FROM jsonb_to_recordset($3::jsonb) AS p(id uuid,name text,checked boolean,quantity numeric,display_order integer)',[h,category,JSON.stringify(fixture)]);
  await db.query('UPDATE shopping.households SET version=version+1 WHERE id=$1',[h]);await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
 check('unique verified-owner household/category created by normal commands; SQL-only synthetic fixture300products/80checked installed atomically',{household_create_id:create.id,category_create_id:cat.id,fixture_rows:300,checked_rows:80});
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
 await context.addInitScript(({session,h})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(session));localStorage.setItem(`futurecart.activeHouseholdId:home:${session.user.id}`,h);localStorage.setItem('futurecart.appLanguage','he');localStorage.setItem('futurecart.soundOn','false');},{session,h});
 const page=await context.newPage();page.setDefaultTimeout(120000);let snapshot;
 page.on('response',async r=>{try{if(r.url()===PREVIEW+'/api/stage3'){const body=await r.json();if(body.result?.status==='snapshot'&&body.result.data?.products?.length===300)snapshot={products:300,bytes:Buffer.byteLength(JSON.stringify(body)),household_revision:Number(body.result.data.household.version)};}}catch{}});
 await page.goto(PREVIEW+'/');await page.getByRole('heading',{name:'קניות לבדיקה',exact:true}).waitFor();await page.getByRole('button',{name:'ייצא מסמך',exact:true}).filter({visible:true}).waitFor();assert.ok(snapshot);assert.ok(snapshot.bytes<262144);
 await page.screenshot({path:out+'/desktop-he-300products.png',fullPage:true});check('actual authenticated original UI loads bounded authoritative300-product snapshot',{snapshot});
 const request=page.waitForRequest(r=>{try{return r.url()===PREVIEW+'/api/stage3'&&r.postDataJSON().intent?.type==='stage4.list.export';}catch{return false;}}),download=page.waitForEvent('download');
 await page.getByRole('button',{name:'ייצא מסמך',exact:true}).filter({visible:true}).click();const operation=(await request).postDataJSON().intent;
 const file=out+'/browser-he-four-column.docx';await(await download).saveAs(file);
 const result=await confirmed(operation,session);assert.equal(result.result.status,'committed');
 const history=(await db.query('SELECT items FROM shopping.shopping_history WHERE id=$1 AND household_id=$2 AND deleted_at IS NULL',[operation.payload.history_id,h])).rows[0];assert.equal(history.items.length,80);
 const counts=(await db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE checked)::int AS checked,count(*) FILTER(WHERE usage_count=1)::int AS used,(SELECT count(*)::int FROM shopping.operations WHERE id=$2) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$2) AS outbox FROM shopping.products WHERE household_id=$1 AND deleted_at IS NULL',[h,operation.id])).rows[0];assert.deepEqual(counts,{total:300,checked:0,used:80,ledger:1,outbox:1});
 const expected={categories:[{name:'קניות לבדיקה',items:fixture.filter(p=>p.checked).map(p=>({name:p.name,quantity:p.quantity}))}]};writeFileSync(out+'/expected.json',JSON.stringify(expected,null,2)+'\n');
 const inspected=JSON.parse(execFileSync('python3',['scripts/stage4-docx-inspect.py',file,'--direction','he','--columns','4','--expected',out+'/expected.json'],{encoding:'utf8'}));assert.equal(inspected.item_count,80);
 check('actual UI80-item export commits history/checkedclear/usage exactly once and downloads4-column Hebrew quantities',{operation_id:operation.id,correlation_id:operation.correlation_id,history_id:operation.payload.history_id,counts,document:inspected});
 await page.reload();await page.getByRole('heading',{name:'קניות לבדיקה',exact:true}).waitFor();check('refresh safely retrieves300retained products after export with checked states cleared');
 await page.getByRole('button',{name:'פתח היסטוריה',exact:true}).click();
 await page.getByText('80 items · Tap to preview',{exact:true}).click();
 const restoredRequest=page.waitForRequest(r=>{try{return r.url()===PREVIEW+'/api/stage3'&&r.postDataJSON().intent?.type==='stage4.list.restore';}catch{return false;}});
 await page.getByRole('button',{name:'Add Selected',exact:true}).click();
 const restore=(await restoredRequest).postDataJSON().intent;assert.equal(restore.payload.product_ids.length,80);
 assert.equal((await confirmed(restore,session)).result.status,'committed');
 const restored=(await db.query('SELECT count(*) FILTER(WHERE checked)::int AS checked,count(*) FILTER(WHERE usage_count=1)::int AS used,count(*) FILTER(WHERE quantity=3)::int AS quantity3 FROM shopping.products WHERE household_id=$1 AND deleted_at IS NULL',[h])).rows[0];
 assert.deepEqual(restored,{checked:80,used:80,quantity3:30});
 check('actual history Add Selected restores80products including quantity labels while retaining current quantities and usage',{operation_id:restore.id,correlation_id:restore.correlation_id,counts:restored});
 report.status='PASS';report.docx=file;
}catch(error){report.status='FAIL';report.error={type:error.name,message:String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]').slice(0,1800)};process.exitCode=1;}
finally{try{await context?.close();await browser?.close();}catch{}await db.end();writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,checks:report.checks.length,report:out+'/report.json',docx:report.docx,error:report.error}));}
