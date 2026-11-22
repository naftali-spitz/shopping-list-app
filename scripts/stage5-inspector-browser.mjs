import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {PREVIEW,previewHeaders} from './stage3-preview-check.mjs';
const require=createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');const {chromium}=require('playwright-core');
const overhead=process.argv[2];assert.ok(overhead,'Pass a completed Stage5 overhead report');const run=JSON.parse(readFileSync(overhead)).runs.find(r=>r.mode==='ON');assert.ok(run);
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0],h=run.household_id;
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual protected Dev Preview inspector; desktop and Android viewport emulation, not a physical Android device',checks:[]};
const folder='docs/stage5/attempts/inspector-'+report.id;mkdirSync(folder,{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 for(const [label,viewport,language] of [['desktop',{width:1440,height:1000},'en'],['android-rtl',{width:412,height:915},'he']]){
  const context=await browser.newContext({viewport,timezoneId:'Asia/Jerusalem',...(label==='android-rtl'?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
  try{
   await context.route(PREVIEW+'/**',route=>route.continue({headers:{...route.request().headers(),...previewHeaders()}}));
   await context.addInitScript(({session,h,language})=>{localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token',JSON.stringify(session));localStorage.setItem(`futurecart.activeHouseholdId:home:${session.user.id}`,h);localStorage.setItem('futurecart.appLanguage',language);localStorage.setItem('futurecart.soundOn','false');},{session,h,language});
   const page=await context.newPage();page.setDefaultTimeout(90000);await page.goto(PREVIEW+'/');
   const summary=page.locator('summary').filter({hasText:language==='en'?'Dev Performance':'ביצועים בפיתוח'});await summary.waitFor();await summary.click();
   await page.getByRole('button',{name:language==='en'?'Apply / refresh':'סינון / רענון',exact:true}).waitFor();
   const operation=run.samples.at(-1).operation_id;await page.getByRole('button').filter({hasText:operation}).click();
   await page.getByRole('region',{name:'Operation details'}).waitFor();
   await page.screenshot({path:folder+'/'+label+'.png',fullPage:true});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,'Dashboard must fit mobile viewport');
   const traceEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Trace JSON',exact:true}).click();const traceDownload=await traceEvent;await traceDownload.saveAs(folder+'/'+label+'-trace.json');const trace=JSON.parse(readFileSync(folder+'/'+label+'-trace.json'));assert.equal(trace.operation_id,operation);assert.ok(trace.records.some(r=>r.spans.length>0));
   const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();const csvDownload=await csvEvent;await csvDownload.saveAs(folder+'/'+label+'.csv');const csv=readFileSync(folder+'/'+label+'.csv','utf8');assert.ok(csv.includes(operation)&&!csv.includes(session.user.email));
   const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'JSON',exact:true}).click();const download=await downloadEvent;await download.saveAs(folder+'/'+label+'.json');
   const exported=JSON.parse(readFileSync(folder+'/'+label+'.json'));assert.ok(exported.operations.some(o=>o.operation_id===operation));const text=JSON.stringify(exported);assert.ok(!text.includes('access_token')&&!text.includes(session.user.email)&&!text.includes('payload'));assert.ok(exported.operations.some(o=>o.records.length));
   const bar=page.locator('[aria-label="Latency trend"] button').first();if(await bar.count()){const bucket=(await bar.getAttribute('aria-label')).slice(0,13)+':00:00.000Z';await bar.click();const query=page.waitForRequest(r=>{try{return r.url()===PREVIEW+'/api/dev-performance'&&r.postDataJSON().action==='history';}catch{return false;}});await page.getByRole('button',{name:language==='en'?'Apply / refresh':'סינון / רענון',exact:true}).click();assert.equal((await query).postDataJSON().from,bucket,'UTC chart bucket must survive local Jerusalem date-input conversion');}
   report.checks.push(label+': PostgreSQL history loaded in fresh browser, trace detail, full trace JSON, redacted CSV/JSON range exports, viewport fit');
   if(label==='desktop'){
    await page.route('**/api/dev-performance',route=>route.abort('failed'));
    const button=page.getByRole('button',{name:/^Increase Measured item/}).filter({visible:true}).first();
    const command=page.waitForRequest(r=>{try{return r.url()===PREVIEW+'/api/stage3'&&r.postDataJSON().action==='command'&&r.postDataJSON().intent.type==='stage4.product.update';}catch{return false;}});
    await button.click();const id=(await command).postDataJSON().intent.id;
    await page.waitForFunction(id=>[...document.querySelectorAll('[data-operation-id]')].some(el=>el.getAttribute('data-operation-id')===id&&el.getAttribute('data-state')==='Saved'),id);
    report.checks.push('aborted diagnostic requests do not prevent real committed Saved');
   }
  }finally{await context.close();}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,message:error.message.slice(0,1800)};process.exitCode=1;}
finally{await browser?.close();writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({folder,...report}));}
