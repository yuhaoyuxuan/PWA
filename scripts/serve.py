#!/usr/bin/env python3
"""Local preview server for PWA Manager — includes export API."""

import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVE_DIR = ROOT / 'dist'
EDITOR_DIR = ROOT / 'editor'
PUBLIC_DIR = ROOT / 'public'
PORT = 8080


class PWAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SERVE_DIR), **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # Route editor files from editor/ directory when not in dist/
        if self.path.startswith('/config-editor') or \
           self.path.startswith('/styles/config-editor') or \
           self.path.startswith('/scripts/config-editor'):
            for subdir in ['', 'styles/', 'scripts/']:
                fp = EDITOR_DIR / subdir / self.path.split('/')[-1]
                if fp.is_file():
                    self.send_response(200)
                    ct = 'text/html' if fp.suffix == '.html' else \
                         'text/css' if fp.suffix == '.css' else \
                         'application/javascript'
                    self.send_header('Content-Type', ct)
                    self.end_headers()
                    self.wfile.write(fp.read_bytes())
                    return
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/export':
            self.handle_export()
        else:
            self.send_error(404)

    def handle_export(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b''

        try:
            config = json.loads(body)
        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Invalid JSON'})
            return

        # Write config to public/
        config_path = PUBLIC_DIR / 'pwa.config.json'
        backup = config_path.read_bytes() if config_path.exists() else None
        try:
            config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), 'utf-8')
            # Run build
            result = subprocess.run(
                [sys.executable, str(ROOT / 'scripts' / 'build.py')],
                capture_output=True, text=True, cwd=str(ROOT)
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr or 'Build failed')

            # Zip dist/
            tmp = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
            try:
                with zipfile.ZipFile(tmp.name, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for f in SERVE_DIR.rglob('*'):
                        if f.is_file() and '.DS_Store' not in f.name:
                            arcname = f.relative_to(SERVE_DIR)
                            zf.write(f, arcname)

                zip_data = Path(tmp.name).read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', f'attachment; filename="pwa-{config["cache"]["version"]}.zip"')
                self.send_header('Content-Length', str(len(zip_data)))
                self.end_headers()
                self.wfile.write(zip_data)
                print(f'  EXPORT: pwa-{config["cache"]["version"]}.zip ({len(zip_data)} bytes)')
            finally:
                Path(tmp.name).unlink(missing_ok=True)
        except Exception as e:
            self.send_json(500, {'error': str(e)})
        finally:
            if backup is not None:
                config_path.write_bytes(backup)

    def send_json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f'  {self.address_string():<16} {format % args}')


if __name__ == '__main__':
    has_editor = EDITOR_DIR.is_dir() and any(EDITOR_DIR.iterdir())

    if not SERVE_DIR.exists():
        print('dist/ not found. Run "python3 scripts/build.py" first.')
        SERVE_DIR = PUBLIC_DIR
        print(f'Falling back to {SERVE_DIR}/ (dev mode)')

    print(f'PWA Manager — Preview Server')
    print(f'Serving: {SERVE_DIR}/')
    print(f'URL:     http://localhost:{PORT}')
    print(f'\nVisit:')
    print(f'  http://localhost:{PORT}/install.html       — Install page')
    if has_editor:
        print(f'  http://localhost:{PORT}/config-editor.html  — Config editor')
        print(f'  Export API: POST /api/export')
    print(f'\nPress Ctrl+C to stop\n')

    http.server.HTTPServer.allow_reuse_address = True
    server = http.server.HTTPServer(('0.0.0.0', PORT), PWAHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
        server.server_close()
