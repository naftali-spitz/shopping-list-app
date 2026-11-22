"""Scan changed evidence for credentials without printing private values."""
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import re
import subprocess
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
assert Path.cwd() == ROOT
assert str(ROOT).endswith('/.worktrees/flespi-home-backend')


def git(*args):
    return subprocess.check_output(['git', *args], text=True).splitlines()


assert git('branch', '--show-current') == ['feature/flespi-home-backend']
paths = sorted(set(git('ls-files', '--others', '--exclude-standard')
                   + git('diff', '--name-only', 'HEAD')))
private_values = set()


def collect(value, key=''):
    if isinstance(value, dict):
        for name, child in value.items():
            collect(child, name)
    elif isinstance(value, list):
        for child in value:
            collect(child, key)
    elif isinstance(value, str) and len(value) > 14 and re.search(
            'password|token|secret|private', key, re.I):
        private_values.add(value.encode())


# Only private files in this worktree are read. Never traverse the original
# checkout, database directory, browser profiles, or backup dumps.
for path in (ROOT / '.stage0-runtime').glob('*.json'):
    try:
        collect(json.loads(path.read_text()))
    except (ValueError, UnicodeError):
        continue
for path in (ROOT / '.stage0-runtime').glob('*password*'):
    if path.is_file() and path.stat().st_size < 4096:
        private_values.add(path.read_bytes().strip())
for path in (ROOT / '.stage0-runtime').glob('*.env'):
    for line in path.read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and not key.startswith('NEXT_PUBLIC_') and re.search(
                'TOKEN|SECRET|PASSWORD|PRIVATE', key):
            try:
                value = json.loads(value) if value.startswith('"') else value
            except ValueError:
                continue
            if isinstance(value, str) and len(value) > 14:
                private_values.add(value.encode())

credential = re.compile(
    rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
    rb'|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    rb'|sb_secret_[A-Za-z0-9]{15,}|gh[pousr]_[A-Za-z0-9]{25,}')
findings = []
archives = 0
for name in paths:
    path = ROOT / name
    if not path.is_file():
        continue
    raw = path.read_bytes()
    payloads = [raw]
    if zipfile.is_zipfile(io.BytesIO(raw)):
        archives += 1
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            payloads += [archive.read(entry) for entry in archive.namelist()]
    if any(secret in payload for secret in private_values if secret
           for payload in payloads):
        findings.append({'path': name, 'reason': 'known private value'})
    if any(credential.search(payload) for payload in payloads):
        findings.append({'path': name, 'reason': 'credential pattern'})

report = {
    'id': str(uuid.uuid4()), 'at': datetime.now(timezone.utc).isoformat(),
    'status': 'FAIL' if findings else 'PASS', 'files_scanned': len(paths),
    'archives_expanded': archives, 'known_private_values_compared': len(private_values),
    'findings': findings, 'scope': 'changed/untracked Git paths; raw bytes and expanded ZIP/DOCX entries; no image OCR',
    'original_checkout_env_loaded': False,
}
output = ROOT / 'docs/stage4/attempts' / ('evidence-audit-' + report['id'] + '.json')
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
raise SystemExit(bool(findings))
