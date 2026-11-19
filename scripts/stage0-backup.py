"""Back up only the isolated development cluster; never use inherited PG config."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.stage0-runtime'
BIN = Path('/usr/lib/postgresql/17/bin')


def main():
    os.umask(0o077)
    # The source and login are fixed; no shell or caller-controlled DB target.
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env['PGPASSWORD'] = (RUNTIME / 'app-password').read_text()
    directory = RUNTIME / 'backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    name = 'shopping-stage0-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.dump'
    temporary = directory / (name + '.partial')
    result = subprocess.run([str(BIN / 'pg_dump'), '-w', '-h', '127.0.0.1', '-p', '55439',
                             '-U', 'shopping_stage0_app', '-d', 'shopping_stage0', '-Fc',
                             '-f', str(temporary)], env=env, capture_output=True)
    if result.returncode:
        raise RuntimeError('Isolated dev backup failed; inspect the dedicated service journal')
    final = directory / name
    temporary.rename(final)
    # Retain only this tool's own regular backup files, never arbitrary paths.
    backups = sorted(p for p in directory.glob('shopping-stage0-*.dump') if p.is_file() and not p.is_symlink())
    for old in backups[:-7]:
        old.unlink()
    print(json.dumps({'status': 'PASS', 'database': 'shopping_stage0', 'port': 55439,
                      'backup': name, 'retention': '7 successful local copies',
                      'off_host_copy': False}))


if __name__ == '__main__':
    main()
