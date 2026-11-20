"""Set only two feature-branch Preview variables; never print their values."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
assert str(ROOT) == '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend'
CLI = '/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel'
PROJECT = 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM'
SCOPE = '0012ab-5576s-projects'
BRANCH = 'feature/flespi-home-backend'
os.umask(0o077)
subprocess.run(['node', 'scripts/stage0-preflight.mjs'], cwd=ROOT, check=True)
config = json.loads((ROOT / '.stage0-runtime/stage3-config.json').read_text())
flespi = json.loads((ROOT / '.stage0-runtime/flespi-dev.json').read_text())
signer = json.loads((ROOT / '.stage0-runtime/stage3-vercel-keys.json').read_text())
config['callbackUrl'] = 'https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/api/stage3'
(ROOT / '.stage0-runtime/stage3-config.json').write_text(json.dumps(config))
server = {'projectId': PROJECT, 'topic': 'shopping-poc/naf-stage0-041d4f122bdd/commands',
          'publisherToken': flespi['publisher_token'], 'signer': signer,
          'commandKeys': config['commandKeys'], 'callbackKeys': {config.get('resultKid', 'callback-1'): config['resultPublicKey']}}
(ROOT / '.stage0-runtime/stage3-vercel-config.json').write_text(json.dumps(server))
for name, value, kind in [('SHOPPING_STAGE3_CONFIG', json.dumps(server), 'secret'), ('SHOPPING_STAGE3_ENABLED', '1', 'config')]:
    result = subprocess.run([CLI, 'env', 'add', name, '--environment', 'preview', '--git-branch', BRANCH,
                             '--project', PROJECT, '--scope', SCOPE, '--type', kind, '--yes', '--non-interactive'],
                            input=value, cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, 'Feature Preview variable configuration failed; output suppressed'
    print(json.dumps({'variable': name, 'target': 'preview', 'branch': BRANCH, 'type': kind, 'status': 'PASS'}))
