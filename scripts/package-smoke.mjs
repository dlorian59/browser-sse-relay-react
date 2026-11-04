import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const run = (args, cwd = root) => execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
run(['run', 'build']);
const [packed] = JSON.parse(run(['pack', '--ignore-scripts', '--json', '--pack-destination', 'output']));
const base = JSON.parse(readFileSync('output/base-package.json', 'utf8'));
assert.ok(packed.files.some(file => file.path === 'LICENSE'));
assert.ok(packed.files.some(file => file.path === 'docs/v0.1.0/guide.en.md'));
const consumer = mkdtempSync(join(tmpdir(), 'sse-react-consumer-'));
try {
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', resolve('output', base.filename), resolve('output', packed.filename), 'react@18.3.1', 'react-dom@18.3.1', '@types/react@18.3.27', '@types/react-dom@18.3.7'], consumer);
  const installed = join(consumer, 'node_modules/@59alex/browser-sse-relay-react');
  const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(metadata.peerDependencies['@59alex/browser-sse-relay'], '^0.1.0');
  assert.match(readFileSync(join(installed, 'dist/index.js'), 'utf8'), /^['"]use client['"]/);
  const snippets = [...readFileSync('README.md', 'utf8').matchAll(/```tsx\n([\s\S]*?)```/g)];
  assert.equal(snippets.length, 2);
  snippets.forEach((match, index) => writeFileSync(join(consumer, `readme-${index}.tsx`), match[1]));
  for (const locale of ['en', 'ru']) {
    const guide = readFileSync(`docs/v0.1.0/guide.${locale}.md`, 'utf8') + '\n' + readFileSync(`docs/v0.1.0/reference.${locale}.md`, 'utf8');
    [...guide.matchAll(/```tsx\n([\s\S]*?)```/g)].forEach((match, index) => writeFileSync(join(consumer, `guide-${locale}-${index}.tsx`), match[1]));
  }
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true }, include: ['*.tsx'] }));
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', consumer], { encoding: 'utf8', stdio: 'inherit' });
  writeFileSync(join(consumer, 'smoke.mjs'), `import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';
const html = renderToString(createElement(SseRelayProvider, {scope: {accountId:'demo',streamId:'notifications'},url:'/events',onEvent(){}},createElement(SseConnectionStatus)));
assert.match(html,/Not connected/); assert.match(html,/role="status"/); console.log('Packed React 18.3.1 consumer: types, examples, SSR, client directive passed');`);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  mkdirSync('output', { recursive: true });
  writeFileSync('output/package-smoke.json', JSON.stringify({ package: metadata.name, version: metadata.version, react: '18.3.1', typedReadmeExamples: snippets.length, clientDirective: true, ssr: true }, null, 2));
} finally { rmSync(consumer, { recursive: true, force: true }); }
