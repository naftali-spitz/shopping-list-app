// Exercise the actual committed export route with synthetic payloads, without DB/Auth.
// Local source-route evidence only; browser/Word rendering remain separate checks.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const run = randomUUID();
const folder = `docs/stage4/attempts/export-${run}`;
mkdirSync(folder, {recursive: true});
mkdirSync('.stage0-runtime', {recursive: true, mode: 0o700});
const temporary = `.stage0-runtime/export-route-${run}.mjs`;
const source = readFileSync('app/api/export-doc/route.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
  .replace('"next/server"', JSON.stringify(pathToFileURL(require.resolve('next/server.js')).href));
writeFileSync(temporary, compiled, {mode: 0o600, flag: 'wx'});
const report = {run, at: new Date().toISOString(), scope: 'actual source export route with synthetic data; no DB; XML checks only', cases: []};
try {
  const {POST} = await import(pathToFileURL(process.cwd() + '/' + temporary));
  for (const language of ['he', 'en']) {
    for (const size of ['small', 'four-column']) {
      const categories = Array.from({length: size === 'small' ? 2 : 8}, (_, c) => ({
        name: language === 'he' ? `קטגוריה ${c+1}` : `Category ${c+1}`,
        items: Array.from({length: size === 'small' ? 3 : 10}, (_, i) => ({
          name: language === 'he' ? `מוצר ${c+1}-${i+1}` : `Product ${c+1}-${i+1}`,
          quantity: i === 0 ? 3 : 1,
        })),
      }));
      const id = `${language}-${size}`;
      const expected = `${folder}/${id}.json`, doc = `${folder}/${id}.docx`;
      writeFileSync(expected, JSON.stringify({categories}, null, 2) + '\n', {flag: 'wx'});
      const response = await POST(new Request('http://127.0.0.1/api/export-doc', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({categories})}));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('Content-Type'), /wordprocessingml/);
      writeFileSync(doc, new Uint8Array(await response.arrayBuffer()), {flag: 'wx'});
      const evidence = JSON.parse(execFileSync('python3', ['scripts/stage4-docx-inspect.py', doc, '--direction', language, '--columns', size === 'small' ? '1' : '4', '--expected', expected], {encoding: 'utf8'}));
      report.cases.push({id, status: 'PASS', evidence});
    }
  }
  const empty = await POST(new Request('http://127.0.0.1/api/export-doc', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({categories: []})}));
  assert.equal(empty.status, 400);
  report.cases.push({id: 'empty-rejected', status: 'PASS', http_status: empty.status});
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = {name: error.name, message: error.message}; process.exitCode = 1;
} finally {
  unlinkSync(temporary);
  writeFileSync(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({run, status: report.status, cases: report.cases.map(c=>({id:c.id,status:c.status})), report: `${folder}/report.json`}));
}
