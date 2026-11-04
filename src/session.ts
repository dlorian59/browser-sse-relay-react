import { MemoryCheckpointStore, SseRelayClient } from '@59alex/browser-sse-relay';
import type { CheckpointStore, RelayContext, RelayEvent, RelayOptions, RelayResult, RelayState, StreamScope } from '@59alex/browser-sse-relay';

export type RelayTransportOptions = Omit<RelayOptions, 'scope' | 'url' | 'onEvent' | 'checkpoint' | 'onState' | 'initialCursor'>;
export interface RelaySnapshot {
  readonly state: RelayState;
  readonly scope: StreamScope | null;
  readonly cursor: string | undefined;
  readonly attempt: number;
  readonly pending: boolean;
  readonly result: RelayResult | undefined;
}
export interface RelayActions {
  stop(): Promise<void>;
  logout(): Promise<void>;
  reconnect(): void;
  /** Apply matching application snapshot state before calling resume with its cursor. */
  resume(cursor: string): void;
}
export interface SessionConfig {
  scope: StreamScope; url: RelayOptions['url']; checkpoint?: CheckpointStore;
  transport?: RelayTransportOptions;
  onEvent: (event: RelayEvent, context: RelayContext) => void | Promise<void>;
}
interface Run { valid: boolean; client?: SseRelayClient; commitTimer?: ReturnType<typeof setTimeout> }
const INITIAL: RelaySnapshot = Object.freeze({ state: 'idle', scope: null, cursor: undefined, attempt: 0, pending: false, result: undefined });

/** Internal per-provider owner; no network or browser globals are used by construction. */
export class SessionOwner {
  private memory = new MemoryCheckpointStore();
  private memoryScope: string | undefined;
  private configuration: object | undefined;
  private readonly listeners = new Set<() => void>();
  private snapshot = INITIAL;
  private active: Run | undefined;
  private config: SessionConfig | null = null;
  private tail: Promise<void> = Promise.resolve();
  readonly getSnapshot = (): RelaySnapshot => this.snapshot;
  readonly getServerSnapshot = (): RelaySnapshot => INITIAL;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  readonly actions: RelayActions = {
    stop: () => this.stop(), logout: () => this.logout(),
    reconnect: () => { if (this.config) this.begin(this.config); },
    resume: cursor => { if (this.config) this.begin(this.config, cursor); },
  };
  private publish(patch: Partial<RelaySnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    for (const listener of this.listeners) listener();
  }
  private invalidate(): void {
    const run = this.active;
    if (!run) return;
    run.valid = false;
    if (run.commitTimer !== undefined) clearTimeout(run.commitTimer);
    run.client?.stop();
  }
  configure(config: SessionConfig | null): () => void {
    const token = {}; this.configuration = token;
    const identity = config ? JSON.stringify([config.scope.accountId, config.scope.streamId]) : undefined;
    if (identity !== this.memoryScope) { this.memory = new MemoryCheckpointStore(); this.memoryScope = identity; }
    this.config = config;
    if (!config) { void this.stop(); this.publish({ scope: null, cursor: undefined, state: 'idle' }); return () => {}; }
    this.begin(config);
    // StrictMode setup/cleanup/setup shares this lane and never overlaps checkpoint writers.
    // StrictMode setup/cleanup/setup использует одну очередь и не создаёт параллельных владельцев checkpoint.
    return () => {
      if (this.configuration === token) { this.config = null; this.configuration = undefined; this.invalidate(); }
    };
  }
  private begin(config: SessionConfig, initialCursor?: string): Run {
    this.invalidate();
    const run: Run = { valid: true }; this.active = run;
    const scope = Object.freeze({ accountId: config.scope.accountId, streamId: config.scope.streamId });
    const checkpoint = config.checkpoint ?? this.memory;
    this.publish({ state: 'connecting', scope, cursor: undefined, attempt: 0, pending: true, result: undefined });
    const current = () => this.active === run && run.valid;
    this.tail = this.tail.then(async () => {
      if (!current()) return;
      const observed: CheckpointStore = {
        load: (identity, signal) => checkpoint.load(identity, signal),
        clear: (identity, signal) => checkpoint.clear(identity, signal),
        save: async (identity, cursor, signal) => {
          await checkpoint.save(identity, cursor, signal);
          signal.throwIfAborted();
          if (!current()) return;
          // Observe the base client's committed cursor after its own continuation; never acknowledge for it.
          // Читаем подтверждённый курсор после продолжения базового клиента, не подтверждаем событие вместо него.
          if (run.commitTimer !== undefined) clearTimeout(run.commitTimer);
          run.commitTimer = setTimeout(() => {
            if (current()) this.publish({ cursor: run.client?.committedCursor });
          }, 0);
        },
      };
      try {
        const client = new SseRelayClient({ ...config.transport, scope, url: config.url, checkpoint: observed,
          ...(initialCursor === undefined ? {} : { initialCursor }),
          onEvent: async (event, context) => {
            if (!current()) { context.signal.throwIfAborted(); throw new Error('Session superseded'); }
            await config.onEvent(event, { ...context, isCurrent: () => current() && context.isCurrent() });
          },
          onState: (state, detail) => { if (current()) this.publish({ state, ...detail, pending: false }); },
        });
        run.client = client;
        const result = await client.start();
        if (current()) this.publish({ state: result.state, cursor: result.cursor, result, pending: false });
      } catch (error) {
        if (current()) this.publish({ state: 'failed', pending: false,
          result: { state: 'failed', reason: 'configuration-failed', cursor: undefined, error } });
      } finally {
        if (run.commitTimer !== undefined) clearTimeout(run.commitTimer);
      }
    });
    return run;
  }
  private async stop(): Promise<void> {
    this.invalidate();
    const run: Run = { valid: true }; this.active = run;
    this.publish({ state: 'closed', pending: true });
    await this.tail;
    if (this.active === run) this.publish({ pending: false });
  }
  private logout(): Promise<void> {
    const config = this.config;
    const checkpoint = config?.checkpoint ?? this.memory;
    this.invalidate();
    const run: Run = { valid: true }; this.active = run;
    this.publish({ state: 'closed', pending: true });
    const operation = this.tail.then(async () => {
      try {
        if (config) await checkpoint.clear(config.scope, new AbortController().signal);
        if (this.active === run) this.publish({ cursor: undefined, pending: false, result: undefined });
      } catch (error) {
        if (this.active === run) this.publish({ state: 'failed', pending: false,
          result: { state: 'failed', reason: 'logout-failed', cursor: this.snapshot.cursor, error } });
        throw error;
      }
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}
