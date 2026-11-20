"""Manage only the dedicated Stage3 development user service."""
import json
from pathlib import Path
import subprocess
import sys
import time
ROOT = Path(__file__).resolve().parents[1]
UNIT = 'shopping-list-stage3-backend.service'
assert str(ROOT) == '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend'
assert Path.cwd() == ROOT
action = sys.argv[1] if len(sys.argv) > 1 else 'status'
assert action in ['install', 'restart', 'stop', 'status']
def run(args):
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()
if action == 'install':
    run(['node','scripts/stage0-preflight.mjs'])
    path = Path.home() / '.config/systemd/user' / UNIT
    assert not path.exists(), 'Existing unit must be reviewed before replacement'
    path.write_text(f'''[Unit]
Description=Shopping List Stage3 isolated development bridge
After=network-online.target shopping-list-stage0-postgres.service
[Service]
Type=simple
WorkingDirectory={ROOT}
Environment=SHOPPING_STAGE3_CONFIG=1
ExecStart=/usr/bin/node {ROOT}/backend/src/listener.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
UMask=0077
MemoryMax=512M
CPUQuota=20%
TasksMax=96
TimeoutStopSec=30
[Install]
WantedBy=default.target
''')
    run(['systemctl','--user','daemon-reload'])
    run(['systemctl','--user','enable','--now',UNIT])
elif action in ['restart','stop']:
    assert run(['systemctl','--user','show',UNIT,'-p','FragmentPath','--value']) == str(Path.home()/'.config/systemd/user'/UNIT)
    run(['systemctl','--user',action,UNIT])
if action != 'stop':
    until = time.monotonic()+30
    while time.monotonic()<until:
        try:
            health=json.loads((ROOT/'.stage0-runtime/stage3-health.json').read_text())
            pid=int(run(['systemctl','--user','show',UNIT,'-p','MainPID','--value']))
            if health['pid']==pid and health['connected'] and health['clock_healthy'] and time.time()-Path(ROOT/'.stage0-runtime/stage3-health.json').stat().st_mtime<10:
                print(json.dumps({'status':'PASS','unit':UNIT,'health':health}));break
        except (FileNotFoundError,ValueError):
            pass
        time.sleep(.5)
    else:
        raise RuntimeError('Dedicated Stage3 service not healthy')
else:
    print(json.dumps({'status':'STOPPED','unit':UNIT}))
