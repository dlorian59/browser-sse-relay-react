import { useMemo } from 'react';
import { createDpopFetch } from '@59alex/browser-sse-relay';
import type { RelayOptions } from '@59alex/browser-sse-relay';
import { SseFeed } from '@59alex/browser-sse-relay-react';

export interface OrderNotice { key: string; text: string }
export function decodeOrderNotice(value: unknown): OrderNotice {
  // Validate business fields once; the component owns the list and connection lifecycle.
  // Проверяем бизнес-поля один раз; список и соединение обслуживает компонент.
  if (!value || typeof value !== 'object' || !('key' in value) || !('text' in value)
      || typeof value.key !== 'string' || !value.key || typeof value.text !== 'string') {
    throw new TypeError('Invalid order notification');
  }
  return { key: value.key, text: value.text };
}
export interface OrderSession {
  accountId: string;
  keyPair: CryptoKeyPair;
  getAccessToken(signal: AbortSignal): string | Promise<string>;
  refreshAuth?: RelayOptions['refreshAuth'];
}
export function OrderNotifications({ session, origin, locale = 'en' }: {
  session: OrderSession; origin: string; locale?: 'en' | 'ru';
}) {
  // Reuse the OAuth key and current-token reader across reconnects.
  // При переподключениях используем ключ OAuth и чтение актуального токена.
  const transport = useMemo(() => ({
    fetch: createDpopFetch({ keyPair: session.keyPair, getAccessToken: session.getAccessToken, origin }),
    ...(session.refreshAuth ? { refreshAuth: session.refreshAuth } : {}),
  }), [session.keyPair, session.getAccessToken, session.refreshAuth, origin]);
  return <SseFeed scope={{ accountId: session.accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport} locale={locale}
    title={locale === 'ru' ? 'Состояние заказов' : 'Order updates'}
    decode={decodeOrderNotice} getKey={notice => notice.key} renderItem={notice => notice.text}
    // The same authenticated transport loads and validates the matching snapshot.
    // Тот же авторизованный транспорт получает и проверяет соответствующий снимок.
    snapshotUrl="/api/snapshot" />;
}
