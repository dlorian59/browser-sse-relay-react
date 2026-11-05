/** Internal synchronous view state: processing completes before the relay saves its cursor. */
export class FeedStore<T> {
  private items: readonly T[] = Object.freeze([]);
  private readonly listeners = new Set<() => void>();
  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('maxItems must be a positive safe integer');
  }
  readonly getSnapshot = (): readonly T[] => this.items;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  };
  private publish(items: Iterable<T>): void {
    this.items = Object.freeze(Array.from(items).slice(-this.limit));
    for (const listener of this.listeners) listener();
  }
  private keyed(items: readonly T[], getKey: (item: T) => string): Map<string, T> {
    const values = new Map<string, T>();
    for (const item of items) {
      const key = getKey(item);
      if (typeof key !== 'string' || !key) throw new TypeError('A feed item needs a non-empty key');
      values.set(key, item);
    }
    return values;
  }
  upsert(item: T, getKey: (item: T) => string): void {
    const values = this.keyed([...this.items, item], getKey);
    this.publish(values.values());
  }
  replace(items: readonly T[], getKey: (item: T) => string): void {
    this.publish(this.keyed(items, getKey).values());
  }
}
