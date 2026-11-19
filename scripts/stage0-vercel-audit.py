"""Read-only Vercel isolation proof, excluding credential values from output.

Requires the official CLI login and private FutureCart Dev key input already
retrieved from the provider. Pulls Preview configs only into ignored private files.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
CLI = str(Path.home() / '.local/share/shopping-list-tools/node_modules/.bin/vercel')
PROJECT = 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM'
TEAM = 'team_h5ZyD1rMpbgnak6COakN03nD'
SCOPE = '0012ab-5576s-projects'
DEV = 'https://shopping-list-app-git-develop-0012ab-5576s-projects.vercel.app/'
DEV_REF = 'njomxqthjglqesxchlbm'
PROD_REF = 'inebdmynrfwmmxcyziyi'


def cli(args):
    # Native `vercel curl` forwards --non-interactive to curl even before the
    # separator. Agent mode is already non-interactive; keep scope before --.
    command = ([CLI, *args[:2], '--scope', SCOPE, *args[2:]] if args[0] == 'curl'
               else [CLI, *args, '--scope', SCOPE, '--non-interactive'])
    result = subprocess.run(command,
                            cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Vercel audit command failed; credential-bearing output suppressed')
    return result.stdout


def api(path):
    return json.loads(cli(['api', path, '--method', 'GET']))


def main():
    os.umask(0o077)
    private = ROOT / '.stage0-runtime'
    config = json.loads((private / 'vercel-dev-input.json').read_text())
    expected = config['variables']
    assert config['projectId'] == PROJECT
    assert expected['NEXT_PUBLIC_SUPABASE_URL'] == f'https://{DEV_REF}.supabase.co'
    assert expected['NEXT_PUBLIC_SUPABASE_ANON_KEY'].startswith('sb_publishable_')
    project = api(f'/v9/projects/{PROJECT}?teamId={TEAM}')
    assert project['accountId'] == TEAM
    assert project['link']['org'] == 'naftali-spitz' and project['link']['repo'] == 'shopping-list-app'
    assert project['link']['productionBranch'] == 'main'
    assert all(not ('production' in row['target'] and ('preview' in row['target'] or 'development' in row['target'])) for row in project['env'])
    baseline = json.loads((private / 'production-metadata-baseline.json').read_text())
    for previous in baseline['env']:
        row = next(row for row in project['env'] if row['id'] == previous['id'])
        assert row['target'] == ['production']
        assert hashlib.sha256(str(row.get('value')).encode()).hexdigest() == previous['opaque_value_digest']
    assert project['targets']['production']['id'] == baseline['productionDeploymentId']
    for branch in ['develop', 'feature/flespi-home-backend']:
        path = private / ('audit-' + branch.replace('/', '-') + '.env')
        cli(['env', 'pull', str(path), '--environment', 'preview', '--git-branch', branch,
             '--project', PROJECT, '--yes'])
        path.chmod(0o600)
        env = {}
        for line in path.read_text().splitlines():
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key] = value.strip().strip('"')
        assert all(env.get(key) == value for key, value in expected.items())
        assert not any(PROD_REF in value for value in env.values())
    deployment = json.loads(cli(['inspect', DEV, '--json']))
    source = api(f'/v13/deployments/{deployment["id"]}?teamId={TEAM}&withGitRepoInfo=true')
    assert source['projectId'] == PROJECT and source['gitSource']['ref'] == 'develop'
    assert source['gitSource']['repoId'] == 1239195094
    assert deployment['readyState'] == 'READY' and deployment.get('target') != 'production'

    def fetch(url):
        return cli(['curl', url, '--', '--fail', '--silent', '--show-error', '--max-time', '25'])

    html = fetch(DEV)
    paths = [path for path in re.findall(r'<script[^>]+src="([^\"]+)"', html)
             if path.startswith('/_next/static/')]
    assert paths
    hosts = set()
    for path in paths:
        hosts.update(re.findall(r'https://([a-z0-9]+\.supabase\.co)', fetch(urljoin(DEV, path))))
    assert hosts == {f'{DEV_REF}.supabase.co'}
    evidence = {'status': 'PASS', 'project_id': PROJECT, 'team_id': TEAM,
                'repository': 'naftali-spitz/shopping-list-app', 'production_branch': 'main',
                'development_base': 'develop', 'preview_url': DEV, 'deployment_id': deployment['id'],
                'git_commit': source['gitSource']['sha'], 'static_bundles_inspected': len(paths),
                'bundle_supabase_hosts': sorted(hosts), 'preview_defaults_isolated': True,
                'production_deployment_unchanged': True, 'production_secret_fingerprints_unchanged': True,
                'browser_key_sha256': hashlib.sha256(expected['NEXT_PUBLIC_SUPABASE_ANON_KEY'].encode()).hexdigest(),
                'verified_at': datetime.now(timezone.utc).isoformat(),
                'scope': 'read-only provider metadata/config/HTML/static; not a Stage 0 GO'}
    (ROOT / 'docs/stage0/vercel-isolation.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))


if __name__ == '__main__':
    main()
