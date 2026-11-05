import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { fixtureApi, until } from './dpop-fixture-client.mjs';
import { startDemo } from '../examples/notifications/server.mjs';

// Record only our loopback fixture, with real client/relay state and synthetic demo accounts.
// Записываем только свой loopback fixture с настоящими состояниями client/relay и demo-аккаунтами.
const assets = resolve('docs/assets');
const output = resolve('output/visual-sse');
await mkdir(assets, { recursive: true }); await mkdir(output, { recursive: true });
const evidence = [];
const browser = await chromium.launch({ headless: true });
async function record(name, scenario) {
  const demo = await startDemo(5183);
  const context = await browser.newContext({ viewport: { width: 800, height: 760 }, deviceScaleFactor: 1,
    colorScheme: 'light', recordVideo: { dir: output, size: { width: 800, height: 760 } } });
  const page = await context.newPage(); const errors = []; const states = new Set();
  page.on('pageerror', error => errors.push(error.message));
  // Delay only request forwarding for legible connecting states; never forge SSE payloads or UI state.
  // Задерживаем только отправку запроса для читаемого connecting; SSE payload и UI state не подменяем.
  await page.route('**/api/events', async route => { await new Promise(resolve => setTimeout(resolve, 650)); await route.continue().catch(() => {}); });
  await page.exposeFunction('captureSseState', state => states.add(state));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const state = document.querySelector('[role=status]')?.getAttribute('data-state');
      if (state) void window.captureSseState(state);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  });
  const click = label => page.getByRole('button', { name: label, exact: true }).click();
  const live = () => page.locator('[role=status][data-state=live]').waitFor();
  const count = n => page.waitForFunction(value => document.querySelector('[data-testid=count]')?.textContent === String(value), n);
  const hold = () => page.waitForTimeout(1100);
  const api = (path, method = 'GET') => fixtureApi(page, path, method);
  const video = page.video();
  try {
    await page.goto(demo.url); await live(); await hold();
    await scenario({page,click,live,count,hold,api});
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(assets, `${name}.png`) });
    evidence.push({ name, states: [...states], pageErrors: errors });
  } finally { await context.close(); await demo.close(); }
  const videoPath = await video.path();
  // One palette and modest frame rate keep real recordings small without drawing synthetic states.
  // Одна палитра и умеренная частота уменьшают запись без рисования вымышленных состояний.
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-threads','2','-filter_complex_threads','1','-i',videoPath,
    '-filter_complex','fps=6,split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop','0',resolve(assets,`${name}.gif`)], {stdio:'inherit'});
  const bytes = (await stat(resolve(assets,`${name}.gif`))).size;
  assert.ok(bytes <= 2_000_000, `${name} exceeds 2 MB: ${bytes}`);
  evidence.at(-1).gifBytes = bytes;
}
try {
  await record('provider', async ({page,click,live,count,hold,api}) => {
    await click('Publish notification'); await count(1); await hold();
    await click('Switch account'); await live(); await count(0); assert.equal(await page.getByTestId('account').textContent(),'bob'); await hold();
    await click('Publish notification'); await count(1); await hold();
    await click('Logout'); await count(0); await until(async () => (await api('stats')).subscribers === 0); await hold();
  });
  await record('recovery', async ({page,click,live,count,hold,api}) => {
    await page.getByRole('checkbox').check();
    await click('Publish notification'); await count(1); await hold();
    const before = (await api('stats')).connections;
    await click('Disconnect'); await page.locator('[role=status][data-state=connecting]').waitFor(); await live();
    assert.ok((await api('stats')).connections > before); await hold();
    await click('Create retention gap'); await page.locator('[role=status][data-state=resync]').waitFor(); await count(1); await hold();
    await click('Restore snapshot'); await live(); await count(7); await hold();
  });
  await record('activity', async ({page,click,live,count,hold,api}) => {
    await page.getByRole('checkbox').check();
    await click('Publish notification'); await count(1); await hold();
    await click('Hide dashboard');
    await until(async () => (await api('stats')).subscribers === 0);
    await api('publish','POST'); await hold();
    await click('Show dashboard'); await live(); await count(2); assert.equal((await api('stats')).subscribers,1); await hold();
  });
  await writeFile(resolve(output,'evidence.json'), JSON.stringify({browser:browser.version(),viewport:'800x760',fixturePort:5183,requestDelayMs:650,slowHandlerMs:250,recordings:evidence},null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
} finally { await browser.close(); }
