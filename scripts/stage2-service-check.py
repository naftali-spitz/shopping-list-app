"""Restart/crash only the dedicated Stage2 user unit; preserve business state."""
import json
import os
from pathlib import Path
import subprocess
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
UNIT = 'shopping-list-stage2-backend.service'


def command(args):
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()


def prop(unit, name):
    return command(['systemctl', '--user', 'show', unit, '-p', name, '--value'])


def health(previous=0):
    until = time.monotonic() + 30
    while time.monotonic() < until:
        try:
            h = json.loads((ROOT / '.stage0-runtime/stage2-health.json').read_text())
            pid = int(prop(UNIT, 'MainPID'))
            if pid and pid != previous and h['pid'] == pid and h['connected'] and h['clock_healthy']:
                assert (Path('/proc') / str(pid)).stat().st_uid == os.getuid()
                assert (Path('/proc') / str(pid) / 'cwd').resolve() == ROOT
                return h
        except (FileNotFoundError, ValueError):
            pass
        time.sleep(0.25)
    raise RuntimeError('Dedicated service failed bounded recovery')


def database_fingerprint():
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env['PGPASSWORD'] = (ROOT / '.stage0-runtime/admin-password').read_text().strip()
    return subprocess.check_output(['/usr/lib/postgresql/17/bin/psql', '-X', '-w', '-h', '127.0.0.1',
                                    '-p', '55439', '-U', 'stage0_owner', '-d', 'shopping_stage0', '-At',
                                    '-c', "SELECT count(*) FROM shopping.operations; SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]')) FROM shopping.products p;"],
                                   cwd=ROOT, env=env, text=True, stderr=subprocess.PIPE).strip()


def main():
    assert Path.cwd() == ROOT
    command(['node', 'scripts/stage0-preflight.mjs'])
    assert prop(UNIT, 'FragmentPath') == str(Path.home() / '.config/systemd/user' / UNIT)
    assert command(['systemctl', '--user', 'is-enabled', UNIT]) == 'enabled'
    first = health()
    pg_pid = prop('shopping-list-stage0-postgres.service', 'MainPID')
    before = database_fingerprint()
    command(['systemctl', '--user', 'restart', UNIT])
    restarted = health(first['pid'])
    assert database_fingerprint() == before
    # Target only the verified unit's MainPID via systemd, never a process-name kill.
    command(['systemctl', '--user', 'kill', '--kill-whom=main', '--signal=SIGKILL', UNIT])
    recovered = health(restarted['pid'])
    assert int(prop(UNIT, 'NRestarts')) >= 1
    assert database_fingerprint() == before
    assert prop('shopping-list-stage0-postgres.service', 'MainPID') == pg_pid
    command(['systemctl', '--user', 'start', 'shopping-list-stage0-backup.service'])
    assert prop('shopping-list-stage0-backup.service', 'ExecMainStatus') == '0'
    assert command(['systemctl', '--user', 'is-active', 'shopping-list-stage0-backup.timer']) == 'active'
    report = {'status': 'PASS', 'tested_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'unit': UNIT, 'enabled': True, 'health_before': first, 'health_after_restart': restarted,
              'health_after_sigkill_automatic_recovery': recovered, 'database_business_fingerprint_unchanged': True,
              'postgres_pid_unchanged': True, 'dedicated_encrypted_backup_service_exit': 0, 'backup_timer_active': True,
              'linger': command(['loginctl', 'show-user', 'naf-w', '-p', 'Linger', '--value']),
              'no_new_privileges': prop(UNIT, 'NoNewPrivileges'), 'memory_max': prop(UNIT, 'MemoryMax'),
              'tasks_max': prop(UNIT, 'TasksMax'), 'host_reboot_performed': False,
              'scope': 'Actual dedicated user-service restart and SIGKILL recovery; no unrelated service/host restart.'}
    (ROOT / f'docs/stage2/attempts/service-{uuid4()}.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
