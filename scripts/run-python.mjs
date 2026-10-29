// Runs a Python script with the project venv if present (so `npm run verify` works everywhere).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venv = path.join(root, '.venv', 'bin', 'python');
const python = existsSync(venv) ? venv : process.platform === 'win32' ? 'python' : 'python3';
const res = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', cwd: root });
process.exit(res.status ?? 1);
