"""Exercise the real feature-Preview flag; preserve committed stores and production."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
import time
from uuid import uuid4
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
assert Path.cwd() == ROOT
assert str(ROOT) == '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend'
CLI = '/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel'
PROJECT = 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM'
TEAM = 'team_h5ZyD1rMpbgnak6COakN03nD'
SCOPE = '0012ab-5576s-projects'
BRANCH = 'feature/flespi-home-backend'
PREVIEW = 'https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app'
SUPABASE = 'https://njomxqthjglqesxchlbm.supabase.co'
OPERATION = '860fa6b5-f3db-49bf-a100-9e2fc6c98100'
GIT_PREVIEW = 'https://shopping-list-hutr0s1wf-0012ab-5576s-projects.vercel.app'
os.umask(0o077)
report = {'id': str(uuid4()), 'at': datetime.now(timezone.utc).isoformat(), 'scope': 'actual feature-branch Preview flag disable/re-enable and deployments; production excluded', 'checks': []}
private = ROOT / '.stage0-runtime'
def cli(args, value=None):
    result = subprocess.run([CLI, *args, '--scope', SCOPE, '--non-interactive'], cwd=ROOT, input=value, capture_output=True, text=True, timeout=600)
    if result.returncode:
        (private / f'rollback-{report["id"]}-diagnostic.log').write_text(result.stdout + result.stderr)
        raise RuntimeError('Scoped Vercel command failed; diagnostics private')
    return result.stdout
def project():
    return json.loads(cli(['api', f'/v9/projects/{PROJECT}?teamId={TEAM}', '--method', 'GET']))
def production_metadata(p):
    return {'deployment': p['targets']['production']['id'], 'env': sorted([{k: row.get(k) for k in ['id','key','target','type','createdAt']} for row in p['env'] if 'production' in row['target']], key=lambda row: row['id'])}
def set_flag(value):
    rows = [r for r in project()['env'] if r['key']=='SHOPPING_STAGE3_ENABLED' and r.get('gitBranch')==BRANCH]
    assert len(rows)==1 and rows[0]['target']==['preview']
    cli(['env','update','SHOPPING_STAGE3_ENABLED','--environment','preview','--git-branch',BRANCH,'--project',PROJECT,'--type','config','--yes'], value)
def deploy(phase):
    print(json.dumps({'phase': phase, 'status': 'deploying_feature_preview'}), flush=True)
    # Preserve the verified GitHub deployment context and branch-scoped vars.
    # Raw CLI uploads lack the required GitHub owner/repository environment.
    source=json.loads(cli(['api','/v13/deployments/dpl_6XgtMiYa7i5zPo4BxskBsFVTugBP?teamId='+TEAM,'--method','GET']))
    assert source['projectId']==PROJECT and source.get('target')!='production' and source['meta']['githubCommitRef']==BRANCH
    raw = cli(['redeploy',GIT_PREVIEW,'--environment','preview'])
    (private / f'rollback-{report["id"]}-{phase}.log').write_text(raw)
    import re
    urls = re.findall(r'https://[a-z0-9-]+\.vercel\.app', raw)
    assert urls
    url = urls[-1]
    dep = json.loads(cli(['inspect',url,'--json']))
    assert dep['readyState']=='READY' and dep.get('target')!='production'
    report[phase] = {'url': url, 'deployment_id': dep['id']}
    # CLI uploads do not necessarily advance Git branch aliases. Explicitly
    # switch only this verified development alias, never a production domain.
    assert PREVIEW=='https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app'
    cli(['alias','set',url,PREVIEW.removeprefix('https://')])
def oidc():
    path=private/'stage3-callback.env'
    if not path.exists(): path=private/'audit-feature-flespi-home-backend.env'
    raw=next(line.split('=',1)[1] for line in path.read_text().splitlines() if line.startswith('VERCEL_OIDC_TOKEN='))
    return json.loads(raw) if raw.startswith('"') else raw
session=json.loads((private/'stage3-sessions.json').read_text())[0]
key=json.loads((private/'vercel-dev-input.json').read_text())['variables']['NEXT_PUBLIC_SUPABASE_ANON_KEY']
household=json.loads((private/'stage3-auth-state.json').read_text())['households'][0]
def request(url, body=None, gateway=False):
    assert url.startswith(SUPABASE+'/functions/v1/') if gateway else url.startswith(PREVIEW+'/')
    headers={'Authorization':'Bearer '+session['access_token']}
    if gateway: headers['apikey']=key
    else: headers['x-vercel-trusted-oidc-idp-token']=oidc()
    data=None if body is None else json.dumps(body).encode()
    if data is not None: headers['Content-Type']='application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers),timeout=30) as r:
            return r.status,r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code,e.read().decode()
def stored():
    code,body=request(SUPABASE+'/functions/v1/shopping-stage3-gateway',{'action':'status','id':OPERATION,'household_id':household},True)
    assert code==200
    result=json.loads(body)['result'];assert result['status']=='committed'
    return hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
def api_state(expected):
    deadline=time.monotonic()+30
    while time.monotonic()<deadline:
        code,body=request(PREVIEW+'/api/stage3',{'action':'status','id':OPERATION,'household_id':household})
        if code==expected:return code,body
        time.sleep(1)
    raise AssertionError(f'Expected Preview API HTTP {expected}, got {code}')
changed=False
try:
    subprocess.run(['node','scripts/stage0-preflight.mjs'],cwd=ROOT,check=True,capture_output=True)
    first=project();assert first['id']==PROJECT and first['accountId']==TEAM and first['link']['productionBranch']=='main'
    baseline=production_metadata(first);fingerprint=stored()
    set_flag('0');changed=True;deploy('disabled')
    api_state(404)
    report['checks'].append({'name':'actual Preview API disabled by feature-only flag','status':'PASS'})
    code,body=request(PREVIEW+'/');assert code==200 and 'FutureCart' in body
    report['checks'].append({'name':'original development app remains available','status':'PASS'})
    assert stored()==fingerprint
    report['checks'].append({'name':'already committed result retained while experimental API disabled','status':'PASS'})
    report['status']='PASS'
except Exception as error:
    report['status']='FAIL';report['error']={'type':type(error).__name__,'message':str(error)}
finally:
    if changed:
        try:
            set_flag('1');deploy('restored')
            code,body=api_state(200)
            assert code==200 and json.loads(body)['result']['status']=='committed'
            assert stored()==fingerprint
            assert production_metadata(project())==baseline
            report['checks'].append({'name':'actual Preview restored and committed result still retrievable; production deployment/secret metadata unchanged','status':'PASS'})
        except Exception as error:
            report['status']='FAIL';report['restore_error']={'type':type(error).__name__,'message':str(error)}
            # Fail closed on the test outcome, but recover the known-good alias.
            cli(['alias','set',GIT_PREVIEW,PREVIEW.removeprefix('https://')])
            report['fallback_alias_restored_to_verified_git_preview']=True
    (ROOT/f'docs/stage3/attempts/rollback-{report["id"]}.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)
    if report.get('status')!='PASS':raise SystemExit(1)
