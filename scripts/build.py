#!/usr/bin/env python3
"""PWA Manager build script — generates a deployable dist/ directory."""

import json
import os
import shutil
import sys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
EDITOR = ROOT / 'editor'
DIST = ROOT / 'dist'

with_editor = '--editor' in sys.argv

def load_config():
    config_path = PUBLIC / 'pwa.config.json'
    if not config_path.exists():
        print(f'ERROR: {config_path} not found')
        sys.exit(1)
    with open(config_path, 'r') as f:
        return json.load(f)

def validate_config(config):
    errors = []
    app = config.get('app', {})
    if not app.get('name'): errors.append('app.name is required')
    if not app.get('short_name'): errors.append('app.short_name is required')
    if not app.get('start_url'): errors.append('app.start_url is required')
    if not app.get('scope'): errors.append('app.scope is required')

    color_fields = ['app.theme_color', 'app.background_color']
    theme = config.get('installPage', {}).get('theme', {})
    for k in theme:
        color_fields.append(f'installPage.theme.{k}')

    for field in color_fields:
        val = config
        for part in field.split('.'):
            val = val.get(part, {}) if isinstance(val, dict) else None
        if val and not re.match(r'^#[0-9a-fA-F]{6}$', str(val)):
            errors.append(f'{field} must be a valid hex color (#RRGGBB), got: {val}')

    cache = config.get('cache', {})
    if cache.get('version') and not re.match(r'^\d+\.\d+\.\d+$', cache['version']):
        errors.append(f'cache.version must be semver (e.g. 1.0.0), got: {cache["version"]}')

    if errors:
        print('Configuration validation failed:')
        for e in errors:
            print(f'  ✗ {e}')
        sys.exit(1)
    print('Configuration validation passed ✓')

def is_external_url(url):
    return url.startswith('http://') or url.startswith('https://') or url.startswith('//')

def to_manifest_start_url(url):
    # Manifest start_url is always the router. index.html detects standalone mode
    # and redirects to the actual configured app.start_url.
    # This ensures external URLs (e.g. https://baidu.com) work correctly,
    # since PWA spec requires manifest start_url to be same-origin.
    return '/'

def generate_manifest(config):
    app = config['app']
    start_url = app.get('start_url', '/')
    manifest_start = to_manifest_start_url(start_url)
    if start_url != '/' and start_url != '/index.html':
        print(f'  NOTE: start_url in config is "{start_url}", manifest uses "/" for PWA spec compliance')
        print(f'        index.html will route to "{start_url}" when launched in standalone mode')

    manifest = {
        'name': app.get('name'),
        'short_name': app.get('short_name'),
        'description': app.get('description', ''),
        'start_url': manifest_start,
        'scope': app.get('scope', '/'),
        'display': app.get('display', 'standalone'),
        'orientation': app.get('orientation', 'portrait-primary'),
        'theme_color': app.get('theme_color', '#000000'),
        'background_color': app.get('background_color', '#ffffff'),
        'icons': app.get('icons', [])
    }
    return manifest

def copy_static_files():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # Files to copy as-is
    copy_patterns = [
        '*.html',
        'sw.js',
    ]
    for pattern in copy_patterns:
        for f in PUBLIC.glob(pattern):
            dest = DIST / f.name
            shutil.copy2(f, dest)
            print(f'  {"COPY":<6} {f.name}')

    # Copy directories (exclude editor assets that were moved)
    dirs_to_copy = ['assets', 'styles', 'scripts']
    for d in dirs_to_copy:
        src = PUBLIC / d
        if src.is_dir():
            dest = DIST / d
            shutil.copytree(src, dest, dirs_exist_ok=True)
            count = sum(1 for _ in dest.rglob('*') if _.is_file())
            print(f'  {"COPY":<6} {d}/ ({count} files)')

    # Editor files — only included with --editor flag
    if with_editor and EDITOR.is_dir():
        print(f'  {"EDITOR":<6} including config editor (--editor)')
        for f in EDITOR.glob('*.html'):
            shutil.copy2(f, DIST / f.name)
        for f in EDITOR.glob('*.css'):
            dest = DIST / 'styles' / f.name
            shutil.copy2(f, dest)
        for f in EDITOR.glob('*.js'):
            dest = DIST / 'scripts' / f.name
            shutil.copy2(f, dest)

def write_manifest(manifest):
    path = DIST / 'manifest.json'
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f'  {"GEN":<6} manifest.json')

def write_config(config):
    path = DIST / 'pwa.config.json'
    with open(path, 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f'  {"COPY":<6} pwa.config.json')

def print_summary(config):
    app = config['app']
    cache = config.get('cache', {})
    print(f'\n{"="*50}')
    print('Build complete ✓')
    print(f'  App:     {app["name"]} ({app["short_name"]})')
    print(f'  Start:   {app["start_url"]}')
    print(f'  Version:  {cache.get("version", "1.0.0")}')
    print(f'  Editor:   {"included" if with_editor else "excluded (use --editor to include)"}')
    print(f'  Output:   {DIST}/')
    print(f'\nDeploy the dist/ directory to your web server.')
    print(f'Run "python3 scripts/serve.py" to preview locally.')

def main():
    print('PWA Manager — Build\n')
    config = load_config()
    validate_config(config)
    manifest = generate_manifest(config)
    print('\nBuilding dist/ ...\n')
    copy_static_files()
    write_manifest(manifest)
    write_config(config)
    print_summary(config)

if __name__ == '__main__':
    main()
