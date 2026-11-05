import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { FeedStore } from '../dist/feed-store.js';
import { SseFeed } from '../dist/index.js';

test('bounded feed upserts by business key and invalid replacement leaves the previous view intact', () => {
  const store = new FeedStore(2); const key = item => item.id;
  store.upsert({ id: 'a', value: 1 }, key); store.upsert({ id: 'b', value: 2 }, key);
  store.upsert({ id: 'a', value: 3 }, key);
  assert.deepEqual(store.getSnapshot(), [{ id: 'a', value: 3 }, { id: 'b', value: 2 }]);
  store.upsert({ id: 'c', value: 4 }, key);
  assert.deepEqual(store.getSnapshot().map(key), ['b', 'c']);
  assert.throws(() => store.replace([{ id: 'd' }, { id: '' }], key));
  assert.deepEqual(store.getSnapshot().map(key), ['b', 'c']);
});
test('ready feed renders without browser globals and exposes localized status and native buttons', () => {
  const html = renderToString(createElement(SseFeed, { scope: null, url: '/events', locale: 'ru',
    decode: value => value, getKey: value => value.id, renderItem: value => value.text }));
  assert.match(html, /Уведомления/); assert.match(html, /role="status"/);
  assert.match(html, /Подключиться/); assert.match(html, /disabled/);
});

test('snapshot route and custom loader cannot silently override one another', () => {
  assert.throws(() => renderToString(createElement(SseFeed, { scope: null, url: '/events',
    snapshotUrl: '/snapshot', loadSnapshot: async () => ({}),
    decode: value => value, getKey: value => value.id, renderItem: value => value.text })), /Choose snapshotUrl or loadSnapshot/);
});

test('snapshot bounds reject disabled byte limits and timers that the platform would clamp', () => {
  const props = { scope: null, url: '/events', decode: value => value,
    getKey: value => value.id, renderItem: value => value.text };
  for (const invalid of [{ snapshotMaxBytes: 0 }, { snapshotMaxBytes: Infinity },
    { snapshotTimeoutMs: 0 }, { snapshotTimeoutMs: 2147483648 }]) {
    assert.throws(() => renderToString(createElement(SseFeed, { ...props, ...invalid })), TypeError);
  }
});
