#!/bin/bash
set -e
cd "$(dirname "$0")"
lsof -ti :8080 | xargs kill 2>/dev/null || true
python3 scripts/serve.py
