"""Receive development MQTT credentials through an interactive SSH TTY only.

No network requests, command-line credentials, token echo or existing-file overwrite.
"""
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import warnings

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.stage0-runtime'


def normalize_token(value):
    value = value.strip().removeprefix('FlespiToken ').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{64}', value):
        raise ValueError('Expected a complete 64-character flespi token; no file saved')
    return value


def store_tokens(path, publisher, listener, channel):
    publisher, listener = normalize_token(publisher), normalize_token(listener)
    if publisher == listener:
        raise ValueError('Publisher and listener must be separate tokens; no file saved')
    if path.parent.is_symlink() or path.parent.stat().st_uid != os.getuid() or path.parent.stat().st_mode & 0o077:
        raise ValueError('Credential directory must be private and owned by the current user')
    payload = {'broker_url': 'mqtts://mqtt.flespi.io:8883', 'channel': channel,
               'publisher_token': publisher, 'listener_token': listener,
               'stored_at': datetime.now(timezone.utc).isoformat()}
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.flespi-input-', delete=False) as file:
            temporary = Path(file.name)
            os.fchmod(file.fileno(), 0o600)
            json.dump(payload, file)
            file.write('\n')
            file.flush()
            os.fsync(file.fileno())
        # Atomic publication, refusing an existing file or destination symlink.
        os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty():
        raise ValueError('Run interactively using ssh -t; do not pass tokens as arguments or pipe them')
    warnings.simplefilter('error', getpass.GetPassWarning)
    path = RUNTIME / 'flespi-dev.json'
    if path.exists() or path.is_symlink():
        raise ValueError('Credential file already exists; refusing to overwrite it')
    channel = json.loads((ROOT / 'docs/stage0/flespi-authorization.json').read_text())['channel']
    print('Development MQTT credential input. Values will not be displayed.')
    publisher = getpass.getpass('Paste NEW publisher token, then Enter: ')
    listener = getpass.getpass('Paste NEW listener token, then Enter: ')
    store_tokens(path, publisher, listener, channel)
    print('Saved development credentials privately (0600). No broker calls performed.')
    print('You can now tell the agent: credentials saved.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileExistsError, getpass.GetPassWarning) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print('Cancelled; no credential values displayed.', file=sys.stderr)
        sys.exit(1)
