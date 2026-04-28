/**
 * In-memory stand-in for react-native-mmkv used by Jest. Mirrors only the
 * surface that the app touches via lib/storage. Each MMKV instance gets its
 * own Map so tests can rely on per-id isolation.
 */
type MMKVValue = string | number | boolean;

class MMKV {
  private store = new Map<string, MMKVValue>();

  set(key: string, value: MMKVValue): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    const v = this.store.get(key);
    return typeof v === "string" ? v : undefined;
  }

  getNumber(key: string): number | undefined {
    const v = this.store.get(key);
    return typeof v === "number" ? v : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const v = this.store.get(key);
    return typeof v === "boolean" ? v : undefined;
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }

  getAllKeys(): string[] {
    return [...this.store.keys()];
  }
}

export { MMKV };

/** Matches the factory shape used by lib/storage/mmkv.ts */
export function createMMKV(_opts?: { id?: string }): MMKV {
  return new MMKV();
}
