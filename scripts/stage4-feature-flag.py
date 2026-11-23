"""Change only the feature Preview Stage4 config flag; never deploy/promote."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CLI = '/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel'
PROJECT = 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM'
TEAM = 'team_h5ZyD1rMpbgnak6COakN03nD'
BRANCH = 'feature/flespi-home-backend'
KEY = 'SHOPPING_STAGE4_ENABLED'
assert Path.cwd() == ROOT
assert str(ROOT) == '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend'
value = sys.argv[1] if len(sys.argv) == 2 else None
assert value in ('0', '1'), 'Explicit0or1required'
subprocess.run(['node', 'scripts/stage0-preflight.mjs'], cwd=ROOT, check=True)

def cli(args, content=None):
    result = subprocess.run([CLI, *args, '--scope', '0012ab-5576s-projects', '--non-interactive'],
                            cwd=ROOT, input=content, text=True, capture_output=True)
    assert result.returncode == 0, 'Feature flag command failed; provider output suppressed'
    return result.stdout

def project():
    return json.loads(cli(['api', f'/v9/projects/{PROJECT}?teamId={TEAM}', '--method', 'GET']))

before = project()
assert before['accountId'] == TEAM and before['link']['repo'] == 'shopping-list-app'
assert before['link']['org'] == 'naftali-spitz' and before['link']['productionBranch'] == 'main'
matching = [r for r in before['env'] if r['key'] == KEY]
assert len(matching) <= 1
for row in matching:
    assert row['target'] == ['preview'] and row.get('gitBranch') == BRANCH and row['type'] in ('plain', 'encrypted')
args = ['env', 'add', KEY, '--environment', 'preview', '--git-branch', BRANCH,
        '--project', PROJECT, '--type', 'config', '--yes']
if matching:
    args += ['--force']
cli(args, value)
after = project()
assert before['targets']['production']['id'] == after['targets']['production']['id']
production_before = [r for r in before['env'] if 'production' in r['target']]
production_after = [r for r in after['env'] if 'production' in r['target']]
assert production_before == production_after
flag = next(r for r in after['env'] if r['key'] == KEY)
assert flag['target'] == ['preview'] and flag.get('gitBranch') == BRANCH
print(json.dumps({'status': 'PASS', 'key': KEY, 'enabled': value == '1', 'target': 'preview',
                  'branch': BRANCH, 'project_id': PROJECT, 'production_metadata_unchanged': True,
                  'deployment_performed': False}))
