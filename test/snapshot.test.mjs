import test from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshotJson } from '../dist/snapshot.js';

const signal = () => new AbortController().signal;
test('snapshot reader rejects declared and actual oversize bodies before parsing and cancels unread bytes', async () => {
  let cancelled = 0;
  const declared = new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Length': '100' } });
  await assert.rejects(readSnapshotJson(declared, 20, signal()), /snapshotMaxBytes/);
  assert.equal(cancelled, 1);
  const streamed = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(10)); controller.enqueue(new Uint8Array(11));
  }, cancel() { cancelled++; } }));
  await assert.rejects(readSnapshotJson(streamed, 20, signal()), /snapshotMaxBytes/);
  assert.equal(cancelled, 2);
});
test('a snapshot deadline aborts a silent body, cancels the reader and cannot produce a parsed result', async () => {
  const controller = new AbortController(); let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const deadline = setTimeout(() => controller.abort(new Error('snapshot deadline')), 10);
  try { await assert.rejects(readSnapshotJson(response, 100, controller.signal), /snapshot deadline/); }
  finally { clearTimeout(deadline); }
  assert.equal(cancelled, true);
});
test('bounded snapshot reading accepts fragmented UTF-8 at the exact byte boundary', async () => {
  const bytes = new TextEncoder().encode('{"text":"Заказ"}');
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  assert.deepEqual(await readSnapshotJson(new Response(body), bytes.byteLength, signal()), { text: 'Заказ' });
});
