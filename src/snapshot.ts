/** Internal reader for the feed's HTTP snapshot route; bounded before parsing JSON. */
export async function readSnapshotJson(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const advertised = response.headers.get('Content-Length');
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > maxBytes)) {
    void response.body?.cancel().catch(() => undefined);
    throw new RangeError('Snapshot response exceeds snapshotMaxBytes');
  }
  if (!response.body) throw new TypeError('Snapshot response has no body');
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  let buffer = new Uint8Array(Math.min(maxBytes, 65536));
  let bytes = 0;
  let complete = false;
  try {
    signal.throwIfAborted();
    while (true) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) { complete = true; break; }
      const total = bytes + next.value.byteLength;
      if (total > maxBytes) throw new RangeError('Snapshot response exceeds snapshotMaxBytes');
      if (total > buffer.byteLength) {
        const expanded = new Uint8Array(Math.min(maxBytes, Math.max(total, buffer.byteLength * 2)));
        expanded.set(buffer.subarray(0, bytes)); buffer = expanded;
      }
      buffer.set(next.value, bytes); bytes = total;
    }
    signal.throwIfAborted();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes))) as unknown;
  } finally {
    signal.removeEventListener('abort', abort);
    // Never wait for an untrusted stream's cancel callback before releasing the UI operation.
    // Не ждём callback отмены недоверенного потока перед завершением операции интерфейса.
    if (!complete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
