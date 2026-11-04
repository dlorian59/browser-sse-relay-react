import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startDemo } from '../examples/notifications/server.mjs';
const demo = await startDemo();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(demo.url);
  const live = () => page.locator('[role=status][data-state=live]').waitFor();
  const count = value => page.waitForFunction(n => document.querySelector('[data-testid=count]')?.textContent === String(n), value);
  await live();
  const stats = () => page.evaluate(async () => (await fetch('/api/stats',{headers:{Authorization:'Bearer demo-alice'}})).json());
  assert.equal((await stats()).subscribers,1);
  const before = (await stats()).connections;
  await page.getByRole('button',{name:/Unrelated render/}).click(); await page.waitForTimeout(100);
  assert.equal((await stats()).connections,before);
  await page.getByRole('button',{name:'Publish notification',exact:true}).click(); await count(1);
  await page.getByRole('button',{name:'Disconnect',exact:true}).click(); await page.waitForFunction(async old => (await(await fetch('/api/stats',{headers:{Authorization:'Bearer demo-alice'}})).json()).connections>old,before); await live();
  await page.getByRole('button',{name:'Create retention gap',exact:true}).click();
  await page.locator('[role=status][data-state=resync]').waitFor(); await count(1);
  await page.getByRole('button',{name:'Restore snapshot',exact:true}).click(); await live(); await count(7);
  // Activity retains the domain view and checkpoint but releases the subscription while hidden.
  // Activity сохраняет состояние и checkpoint, но освобождает подписку скрытого представления.
  await page.getByRole('button',{name:'Hide dashboard',exact:true}).click();
  await page.waitForFunction(async () => (await(await fetch('/api/stats',{headers:{Authorization:'Bearer demo-alice'}})).json()).subscribers===0);
  await page.evaluate(async () => { const response = await fetch('/api/publish',{method:'POST',headers:{Authorization:'Bearer demo-alice'}}); if (!response.ok) throw new Error('Hidden publish failed'); });
  await page.getByRole('button',{name:'Show dashboard',exact:true}).click(); await live(); await count(8);
  assert.equal((await stats()).subscribers,1);
  await page.getByRole('button',{name:'Switch account',exact:true}).click(); await live(); await count(0);
  assert.equal(await page.getByTestId('account').textContent(),'bob');
  await page.getByRole('button',{name:'Publish notification',exact:true}).click(); await count(1);
  await page.getByRole('button',{name:'Logout',exact:true}).click(); await count(0);
  await page.waitForFunction(async () => (await(await fetch('/api/stats',{headers:{Authorization:'Bearer demo-alice'}})).json()).subscribers===0);
  assert.equal(await page.getByTestId('cursor').textContent(),'none');assert.deepEqual(errors,[]);
  await mkdir('output',{recursive:true});
  const result={browser:browser.version(),scenarios:['StrictMode single subscriber','unrelated render keeps connection','notification commit','disconnect reconnect','retention gap fails closed','snapshot restores seven notifications','Activity hide closes transport and show replays into retained state','account switch isolates state','logout closes subscription'],pageErrors:errors};
  await writeFile('output/browser-smoke.json',JSON.stringify(result,null,2)+'\n');
  console.log(result);
} finally { await browser?.close(); await demo.close(); }
