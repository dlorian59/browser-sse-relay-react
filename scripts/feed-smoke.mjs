import assert from 'node:assert/strict';
import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startDemo } from '../examples/notifications/server.mjs';
import { FeedDefaults } from '../dist/index.js';
import { fixtureApi, until } from './dpop-fixture-client.mjs';

const record = process.argv.includes('--record');
const out = resolve('output/feed'); await mkdir(out, { recursive: true });
const demo = await startDemo(); const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 800, height: 760 },
  ...(record ? { recordVideo: { dir: out, size: { width: 800, height: 760 } } } : {}) });
const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
const video = page.video();
const click = name => page.getByRole('button', { name, exact: true }).click();
const live = () => page.locator('[role=status][data-state=live]').waitFor();
const count = expected => page.locator(`[data-feed-count="${expected}"]`).waitFor();
const hold = () => record ? page.waitForTimeout(900) : Promise.resolve();
try {
  await page.goto(`${demo.url}/feed.html`); await live(); await count(0); await hold();
  await click('Publish order update'); await count(1); await hold();
  await click('Disconnect network'); await live(); await count(1);
  await click('Pause'); await until(async () => (await fixtureApi(page, 'stats')).subscribers === 0); await hold();
  await click('Expire history while paused'); await click('Reconnect');
  await page.locator('[data-state=resync]').waitFor(); await hold();
  await click('Restore updates'); await live(); await count(7); await hold();
  // A scope switch must hide all previous account data before opening the next stream.
  // Смена аккаунта скрывает прежние данные до подключения следующего потока.
  await click('Switch account'); await live(); await count(0); await hold();
  await click('Publish order update'); await count(1); await hold();
  await page.screenshot({ path: record ? resolve('docs/assets/feed.png') : resolve(out, 'feed.png') });
  if (record) {
    assert.deepEqual(errors, []);
  } else {
    // Invalid snapshot cannot replace the view or advance the cursor; retry remains available.
    // Неверный снимок не заменяет список и курсор; корректный повтор остаётся доступен.
    await click('Pause'); await click('Expire history while paused'); await click('Reconnect');
    await page.locator('[data-state=resync]').waitFor();
    await page.route('**/api/snapshot', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ scope: { accountId: 'wrong-account', streamId: 'notifications' }, cursor: 'origin', items: [] }) }));
    await click('Restore updates'); await page.getByRole('alert').waitFor(); await count(1);
    await page.unroute('**/api/snapshot');
    // A byte overflow or deadline leaves the last good view intact and the restore button usable.
    // Превышение байтов или срока сохраняет последний список и доступность восстановления.
    await page.route('**/api/snapshot', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ padding: 'x'.repeat(FeedDefaults.SNAPSHOT_MAX_BYTES + 1) }) }));
    await click('Restore updates'); await page.getByRole('alert').waitFor(); await count(1);
    assert.equal(await page.getByRole('button', { name: 'Restore updates', exact: true }).isEnabled(), true);
    await page.unroute('**/api/snapshot');
    let releaseTimedOut; const timeoutGate = new Promise(resolve => { releaseTimedOut = resolve; });
    await page.route('**/api/snapshot', async route => { await timeoutGate; await route.continue().catch(() => {}); });
    await click('Restore updates'); await page.getByRole('button', { name: 'Working…', exact: true }).waitFor();
    await page.getByRole('alert').waitFor({ timeout: 15000 }); await count(1);
    assert.equal(await page.getByRole('button', { name: 'Restore updates', exact: true }).isEnabled(), true);
    releaseTimedOut(); await page.unroute('**/api/snapshot');
    await click('Restore updates'); await live(); await count(7);
    // A late snapshot from an old account is ignored even if the network cannot be cancelled in time.
    // Поздний снимок старого аккаунта не применяется, даже если сеть не успела отменить ответ.
    await click('Pause'); await click('Expire history while paused'); await click('Reconnect');
    await page.locator('[data-state=resync]').waitFor();
    let release; const gate = new Promise(resolve => { release = resolve; });
    let requested = false;
    await page.route('**/api/snapshot', async route => { requested = true; await gate; await route.continue().catch(() => {}); });
    await click('Restore updates'); await until(() => requested);
    await click('Switch account'); release(); await page.locator('[data-state=resync]').waitFor();
    // Alice's old history was pruned: the new empty view may need its own snapshot, never Bob's.
    // История Alice могла истечь: новый пустой список восстанавливается своим снимком, не снимком Bob.
    await page.unroute('**/api/snapshot');
    await count(0);
    assert.deepEqual(errors, []);
  }
  console.log('Ready feed: DPoP, reconnect, pause, snapshot recovery and account isolation passed');
} finally { await context.close(); await demo.close(); await browser.close(); }
if (record) {
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-threads','2','-filter_complex_threads','1','-i',await video.path(),
    '-filter_complex','fps=6,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none',
    '-loop','0',resolve('docs/assets/feed.gif')]);
  assert.ok((await stat('docs/assets/feed.gif')).size < 2_000_000);
}
