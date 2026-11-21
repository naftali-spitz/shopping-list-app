"""Synthetic, disposable Stage 0 PostgreSQL transaction/restore/restart proof.

Uses only a NEW private cluster, never the system PostgreSQL cluster. Runtime
credentials remain in the ignored owner-only directory. Refuses an existing run.
"""
import json
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.stage0-runtime'
BIN = Path('/usr/lib/postgresql/17/bin')
PORT = '55439'


def run(name, args, *, password=None, sql=None, check=True):
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    if password:
        env['PGPASSWORD'] = password
    result = subprocess.run([str(BIN / name), *args], input=sql, text=True,
                            capture_output=True, env=env)
    if check and result.returncode:
        # PostgreSQL errors could include submitted SQL/passwords. Keep them private.
        (RUNTIME / 'failure.log').write_text(result.stdout + result.stderr)
        raise RuntimeError(f'{name} failed; inspect private runtime failure.log')
    return result


def main():
    os.umask(0o077)
    if RUNTIME.exists():
        raise RuntimeError('Refusing existing runtime. Preserve evidence; review before removing/reusing.')
    RUNTIME.mkdir(mode=0o700)
    admin_password, app_password = secrets.token_urlsafe(40), secrets.token_urlsafe(40)
    password_file = RUNTIME / 'admin-password'
    password_file.write_text(admin_password)
    (RUNTIME / 'app-password').write_text(app_password)
    data = RUNTIME / 'data'
    run('initdb', ['-D', str(data), '-U', 'stage0_owner', '--pwfile', str(password_file),
                  '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--no-locale'])
    with (data / 'postgresql.conf').open('a') as config:
        config.write(f"\nlisten_addresses = '127.0.0.1'\nport = {PORT}\n"
                     "unix_socket_directories = ''\nmax_connections = 10\nshared_buffers = '32MB'\n")
    pgctl = ['-D', str(data), '-l', str(RUNTIME / 'postgres.log'), '-w']
    run('pg_ctl', [*pgctl, 'start'])
    started = True
    try:
        def sql(text, db='postgres', app=False, check=True):
            return run('psql', ['-X', '-w', '-h', '127.0.0.1', '-p', PORT, '-U',
                               'shopping_stage0_app' if app else 'stage0_owner', '-d', db,
                               '-v', 'ON_ERROR_STOP=1', '-At'],
                       password=app_password if app else admin_password, sql=text, check=check)

        sql(f"CREATE ROLE shopping_stage0_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '{app_password}';\n"
            "REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;\n"
            "REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;\n"
            "CREATE DATABASE shopping_stage0 OWNER shopping_stage0_app;\n"
            "CREATE DATABASE shopping_stage0_restore OWNER shopping_stage0_app;")
        sql("CREATE TABLE preflight_probe(id integer PRIMARY KEY, value text NOT NULL);\n"
            "BEGIN; INSERT INTO preflight_probe VALUES(1,'synthetic-rollback'); ROLLBACK;\n"
            "DO $$ BEGIN IF EXISTS(SELECT FROM preflight_probe) THEN RAISE EXCEPTION 'rollback failed'; END IF; END $$;\n"
            "INSERT INTO preflight_probe VALUES(2,'synthetic-backup');", 'shopping_stage0', app=True)
        for statement in ['CREATE DATABASE must_be_denied;', 'SET ROLE stage0_owner;']:
            assert sql(statement, 'shopping_stage0', app=True, check=False).returncode != 0
        assert sql('SELECT 1;', 'postgres', app=True, check=False).returncode != 0
        privileges = sql("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user;",
                         'shopping_stage0', app=True).stdout.strip()
        assert privileges == 'f|f|f|f'
        backup = RUNTIME / 'synthetic.dump'
        common = ['-h', '127.0.0.1', '-p', PORT, '-U', 'shopping_stage0_app', '-w']
        run('pg_dump', [*common, '-d', 'shopping_stage0', '-Fc', '-f', str(backup)], password=app_password)
        run('pg_restore', [*common, '-d', 'shopping_stage0_restore', '--no-owner', '--exit-on-error', str(backup)], password=app_password)
        assert sql('SELECT id,value FROM preflight_probe;', 'shopping_stage0_restore', app=True).stdout.strip() == '2|synthetic-backup'
        run('pg_ctl', [*pgctl, 'restart', '-m', 'fast'])
        assert sql('SELECT id,value FROM preflight_probe;', 'shopping_stage0', app=True).stdout.strip() == '2|synthetic-backup'
        listener = sql('SHOW listen_addresses; SHOW port;').stdout.strip()
        assert listener == '127.0.0.1\n55439'
        report = {'status': 'PASS', 'scope': 'isolated local preflight cluster only; not boot/systemd readiness',
                  'version': run('postgres', ['--version']).stdout.strip(),
                  'host': '127.0.0.1', 'port': PORT, 'database': 'shopping_stage0',
                  'role': 'shopping_stage0_app', 'role_privileges': privileges,
                  'tests': ['transaction rollback', 'commit', 'create database denied', 'admin role denied',
                            'other database connection denied', 'custom-format backup', 'restore exact synthetic row',
                            'restart preserves commit', 'loopback-only configuration'], 'running_after_test': False}
    finally:
        if started:
            run('pg_ctl', [*pgctl, 'stop', '-m', 'fast'])
    (RUNTIME / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
