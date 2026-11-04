import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const base = resolve(process.env.SSE_RELAY_SOURCE ?? '../browser-sse-relay');
mkdirSync('output', { recursive: true });
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
run('npm', ['ci', '--ignore-scripts'], base);
run('npm', ['run', 'build'], base);
const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', resolve('output')], base));
const tar = resolve('output', packed.filename);
// Local artifact supplies the unpublished peer without rewriting the published semver contract.
// Локальный архив предоставляет неопубликованный peer без изменения semver-контракта пакета.
run('npm', ['install', '--no-save', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund', tar]);
writeFileSync('output/base-package.json', JSON.stringify({ filename: packed.filename, name: packed.name, version: packed.version }) + '\n');
console.log('Installed development dependencies and local browser-sse-relay artifact.');
