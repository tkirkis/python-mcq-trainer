#!/usr/bin/env bash
# One-time setup: Python venv used to verify questions + Node dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --quiet -r requirements-verify.txt
npm install
echo "Setup done. Try: npm run verify && npm run dev"
