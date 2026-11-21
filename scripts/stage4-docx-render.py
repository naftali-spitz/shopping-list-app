#!/usr/bin/env python3
"""Render DOCX with private extracted Debian LibreOffice; never install packages.

Preparation is explicit: --prepare downloads signed-repository packages into the
ignored runtime, then extracts them without maintainer scripts or system writes.
Each run produces a new evidence directory. This is LibreOffice compatibility
rendering, not a claim that Microsoft Word itself was executed.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.stage0-runtime/docx-render'
LO_VERSION = '4:25.2.3-2+deb13u6'


def run(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def prepare():
    PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    packages = PRIVATE / 'packages'
    packages.mkdir(exist_ok=True)
    plan = run(['apt-get', '-s', '--no-install-recommends', 'install',
                'libreoffice-writer', 'poppler-utils'])
    if plan.returncode:
        raise RuntimeError('Read-only Debian dependency simulation failed')
    names = [line.split()[1] for line in plan.stdout.splitlines() if line.startswith('Inst ')]
    # Pin the internally consistent tested LibreOffice build. The machine's newer
    # security-index candidate had three404objects; this older signed-index build
    # remains a private compatibility-test tool, not a system package downgrade.
    specs = [name + '=' + LO_VERSION if name.startswith(('libreoffice', 'libuno', 'uno-libs', 'ure'))
             else name for name in names]
    download = run(['apt-get', 'download', *specs], cwd=packages)
    (PRIVATE / 'prepare-download.log').write_text(download.stdout + download.stderr)
    if download.returncode:
        raise RuntimeError('Private Debian package download failed; see ignored preparation log')
    target = PRIVATE / 'root'
    target.mkdir(exist_ok=True)
    manifest = []
    for package in sorted(packages.glob('*.deb')):
        fields = run(['dpkg-deb', '-f', str(package), 'Package', 'Version'])
        if fields.returncode:
            raise RuntimeError('Cannot inspect downloaded package')
        metadata = dict(line.split(': ', 1) for line in fields.stdout.splitlines())
        name, version = metadata['Package'], metadata['Version']
        if name not in names:
            continue
        if name.startswith(('libreoffice', 'libuno', 'uno-libs', 'ure')) and version != LO_VERSION:
            continue
        extracted = run(['dpkg-deb', '-x', str(package), str(target)])
        if extracted.returncode:
            raise RuntimeError('Private package extraction failed')
        manifest.append({'package': name, 'version': version,
                         'sha256': hashlib.sha256(package.read_bytes()).hexdigest()})
    program = target / 'usr/lib/libreoffice/program'
    fundamental = program / 'fundamentalrc'
    fundamental.write_text(fundamental.read_text().replace(
        'file:///usr/lib/libreoffice', (target / 'usr/lib/libreoffice').as_uri()))
    # Debian's maintainer normally materializes this default into /etc. Reproduce
    # only that copy inside the extracted private root; run no package scripts.
    config = target / 'etc/libreoffice/registry/main.xcd'
    config.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(target / 'usr/lib/libreoffice/share/.registry/main.xcd', config)
    for path in target.rglob('*'):
        if path.is_symlink():
            destination = os.readlink(path)
            if destination.startswith(('/usr/', '/etc/', '/var/')):
                private_destination = target / destination[1:]
                if private_destination.exists():
                    path.unlink()
                    path.symlink_to(private_destination)
    (PRIVATE / 'package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--label', default='actual-route')
    parser.add_argument('documents', nargs='+', type=Path)
    args = parser.parse_args()
    assert Path.cwd().resolve() == ROOT
    assert str(ROOT) == '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend'
    subprocess.run(['node', 'scripts/stage0-preflight.mjs'], cwd=ROOT, check=True, capture_output=True)
    if args.prepare:
        prepare()
    target = PRIVATE / 'root'
    program = target / 'usr/lib/libreoffice/program'
    binary = program / 'soffice.bin'
    assert binary.is_file(), 'Run --prepare once to create the private renderer'
    identifier = str(uuid4())
    evidence = ROOT / ('docs/stage4/attempts/docx-render-' + identifier)
    evidence.mkdir()
    profile = PRIVATE / ('profile-' + identifier)
    env = dict(os.environ, LD_LIBRARY_PATH=str(program) + ':' + str(target / 'usr/lib/x86_64-linux-gnu'),
               SAL_USE_VCLPLUGIN='svp')
    version = run([str(binary), '-env:UserInstallation=' + profile.as_uri(), '--version'], env=env)
    assert version.returncode == 0, 'Private LibreOffice startup failed'
    report = {'id': identifier, 'at': datetime.now(timezone.utc).isoformat(), 'label': args.label,
              'renderer': version.stdout.strip(), 'renderer_scope': 'LibreOffice-compatible visual rendering; Microsoft Word not executed',
              'system_install': False, 'private_profile': True, 'cases': []}
    failed = False
    try:
        for document in args.documents:
            source = document.resolve()
            assert source.is_relative_to(ROOT / 'docs/stage4/attempts')
            result = run([str(binary), '-env:UserInstallation=' + profile.as_uri(), '--headless',
                          '--convert-to', 'pdf', '--outdir', str(evidence), str(source)], env=env, timeout=60)
            # LibreOffice uses81after a newly initialized profile asks its launcher
            # to restart. Retry only this exact non-conversion startup response.
            if result.returncode == 81:
                result = run([str(binary), '-env:UserInstallation=' + profile.as_uri(), '--headless',
                              '--convert-to', 'pdf', '--outdir', str(evidence), str(source)], env=env, timeout=60)
            pdf = evidence / (source.stem + '.pdf')
            case = {'source': str(source.relative_to(ROOT)), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'conversion_returncode': result.returncode, 'pdf': str(pdf.relative_to(ROOT)),
                    'pdf_exists': pdf.exists()}
            (evidence / (source.stem + '.renderer.log')).write_text(result.stdout + result.stderr)
            if not pdf.exists() or result.returncode:
                failed = True
            else:
                prefix = evidence / source.stem
                raster = run([str(target / 'usr/bin/pdftoppm'), '-png', '-r', '110', '-f', '1',
                              '-singlefile', str(pdf), str(prefix)], env=env)
                bbox = run([str(target / 'usr/bin/pdftotext'), '-bbox', str(pdf), str(prefix) + '.html'], env=env)
                info = run([str(target / 'usr/bin/pdfinfo'), str(pdf)], env=env)
                (evidence / (source.stem + '.pdfinfo.txt')).write_text(info.stdout)
                case.update({'raster_returncode': raster.returncode, 'bbox_returncode': bbox.returncode,
                             'image': str(prefix.relative_to(ROOT)) + '.png', 'bbox': str(prefix.relative_to(ROOT)) + '.html'})
                failed |= bool(raster.returncode or bbox.returncode)
            report['cases'].append(case)
        report['status'] = 'FAIL' if failed else 'RENDERED_PENDING_VISUAL_REVIEW'
    except Exception as error:
        report['status'] = 'FAIL'
        report['error'] = {'type': type(error).__name__, 'message': str(error)[:1000]}
        failed = True
    finally:
        (evidence / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'status': report['status'], 'report': str((evidence / 'report.json').relative_to(ROOT)),
                          'cases': len(report['cases'])}))
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
