import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryCheckpointStore } from '@59alex/browser-sse-relay';
import { SessionOwner } from '../dist/session.js';
import { SseRelayProvider, SseConnectionStatus } from '../dist/index.js';
const a = { accountId: 'a', streamId: 'notifications' }, b = { ...a, accountId: 'b' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(check) { const start=Date.now(); while(!check()) { if(Date.now()-start>2000) throw new Error('timeout'); await new Promise(r=>setTimeout(r,2)); } }
function response(scope, after='origin', eventId) {
  const control=(event,data)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const watermark=eventId??after;
  const wire=control('relay-hello',{protocol:1,scope,after,watermark})+(eventId?`id: ${eventId}\nevent: message\ndata: hello\n\n`:'')+control('relay-ready',{scope,watermark});
  return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(wire));}}),{headers:{'Content-Type':'text/event-stream','X-Relay-Protocol':'1'}});
}
const config=(scope,fetch,onEvent=()=>{},checkpoint)=>({scope,url:'https://fixture.invalid/events',onEvent,transport:{fetch,retry:{maxAttempts:1}},...(checkpoint?{checkpoint}:{})});
test('StrictMode setup-cleanup-setup skips abandoned starts and closes the surviving transport',async()=>{
  const owner=new SessionOwner();let requests=0;
  const input=config(a,async()=>{requests++;return response(a);});
  const cleanup=owner.configure(input);cleanup();owner.configure(input);
  await until(()=>owner.getSnapshot().state==='live');assert.equal(requests,1);
  await owner.actions.stop();assert.equal(owner.getSnapshot().state,'closed');assert.equal(owner.getSnapshot().pending,false);
});
test('account replacement waits for old handler; old context is invalid and never checkpoints into either scope',async()=>{
  const owner=new SessionOwner(), pending=deferred(), checkpoint=new MemoryCheckpointStore();let context,secondRequests=0;
  owner.configure(config(a,async()=>response(a,'origin','a1'),async(_event,ctx)=>{context=ctx;await pending.promise;},checkpoint));
  await until(()=>context!==undefined);
  owner.configure(config(b,async()=>{secondRequests++;return response(b);},()=>{},checkpoint));
  assert.equal(context.signal.aborted,true);assert.equal(context.isCurrent(),false);
  await new Promise(r=>setTimeout(r,15));assert.equal(secondRequests,0);
  pending.resolve();await until(()=>owner.getSnapshot().state==='live');
  assert.equal(secondRequests,1);assert.deepEqual(owner.getSnapshot().scope,b);
  assert.equal(await checkpoint.load(a,new AbortController().signal),undefined);
  assert.equal(await checkpoint.load(b,new AbortController().signal),undefined);
  await owner.actions.stop();
});
test('logout clearing finishes before replacement checkpoint load/start',async()=>{
  const owner=new SessionOwner(), clearing=deferred();let entered=false,loads=0;
  const checkpoint={async load(){loads++;},async save(){},async clear(){entered=true;await clearing.promise;}};
  const input=config(a,async()=>response(a),()=>{},checkpoint);
  owner.configure(input);await until(()=>owner.getSnapshot().state==='live');
  const logout=owner.actions.logout();await until(()=>entered);
  owner.actions.reconnect();await new Promise(r=>setTimeout(r,15));assert.equal(loads,1);
  clearing.resolve();await logout;await until(()=>owner.getSnapshot().state==='live');assert.equal(loads,2);
  await owner.actions.stop();
});
test('resume persists the supplied snapshot cursor and resumes from it; cursor observation follows commit',async()=>{
  const owner=new SessionOwner(), checkpoint=new MemoryCheckpointStore(), cursors=[];
  let calls=0;
  owner.configure(config(a,async(_url,init)=>{cursors.push(init.headers.get('Last-Event-ID'));return ++calls===1?response(a,'origin','a1'):response(a,'snapshot');},()=>{},checkpoint));
  await until(()=>owner.getSnapshot().cursor==='a1');
  owner.actions.resume('snapshot');await until(()=>calls===2&&owner.getSnapshot().state==='live');
  assert.deepEqual(cursors,[null,'snapshot']);assert.equal(owner.getSnapshot().cursor,'snapshot');
  assert.equal(await checkpoint.load(a,new AbortController().signal),'snapshot');await owner.actions.stop();
});
test('logout failures surface to the caller and status without starting another connection',async()=>{
  const owner=new SessionOwner();let calls=0;
  owner.configure(config(a,async()=>{calls++;return response(a);},()=>{}, {async load(){},async save(){},async clear(){throw new Error('storage denied');}}));
  await until(()=>owner.getSnapshot().state==='live');
  await assert.rejects(owner.actions.logout(),/storage denied/);
  assert.equal(calls,1);assert.equal(owner.getSnapshot().result.reason,'logout-failed');assert.equal(owner.getSnapshot().pending,false);
});
test('server rendering is idle, accessible, customizable and performs no I/O',()=>{
  let calls=0;
  const tree=createElement(SseRelayProvider,{scope:a,url:'https://fixture.invalid',onEvent(){},transport:{fetch:async()=>{calls++;throw new Error('must not fetch');}}},
    createElement(SseConnectionStatus,{labels:{idle:'Ожидание'}}));
  const html=renderToString(tree);assert.match(html,/role="status"/);assert.match(html,/aria-live="polite"/);assert.match(html,/Ожидание/);assert.equal(calls,0);
});
test('cleanup stops a replacement run and retained actions cannot restart an unmounted provider',async()=>{
  const owner=new SessionOwner();let requests=0;
  const cleanup=owner.configure(config(a,async()=>{requests++;return response(a);}));
  await until(()=>owner.getSnapshot().state==='live');owner.actions.reconnect();
  await until(()=>requests===2&&owner.getSnapshot().state==='live');
  cleanup();owner.actions.reconnect();owner.actions.resume('stale');await owner.actions.stop();
  assert.equal(requests,2);
});
test('default checkpoints are reset across scope changes, including returning to the first account',async()=>{
  const owner=new SessionOwner();let lastHeader;
  owner.configure(config(a,async()=>response(a,'origin','a1')));
  await until(()=>owner.getSnapshot().cursor==='a1');
  owner.configure(config(b,async()=>response(b)));await until(()=>owner.getSnapshot().state==='live');
  owner.configure(config(a,async(_url,init)=>{lastHeader=init.headers.get('Last-Event-ID');return response(a);}));
  await until(()=>owner.getSnapshot().state==='live');assert.equal(lastHeader,null);await owner.actions.stop();
});
