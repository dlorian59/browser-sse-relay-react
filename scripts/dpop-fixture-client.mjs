// Synthetic automation identity is separate from the UI session so logout can still be observed server-side.
// Synthetic identity автоматизации отделена от UI-сессии, чтобы после logout проверить состояние сервера.
export function fixtureApi(page, path, method = 'GET') {
  return page.evaluate(async ({ path, method }) => {
    const auth = await import('/auth.ts');
    window.__sseFixtureIdentity ??= auth.loginDemo('alice', window.location.origin);
    return auth.demoRequest(await window.__sseFixtureIdentity, path, method);
  }, { path, method });
}
export async function until(check) {
  const deadline = Date.now() + 10000;
  while (!await check()) {
    if (Date.now() > deadline) throw new Error('Fixture condition timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
