interface CachedModel<T> {
  readonly model: Promise<T | null>;
  readonly expires: number;
}
const FRESH_MS = 60_000;
const RETRY_MS = 5000;
const MAX_MODELS = 20;

/** One request, retry and expiry policy for a reader; no model computation belongs in the cache. */
export function modelRequestOf<T>(
  decode: (value: unknown) => T | null,
): (relative: string) => { readonly model: Promise<T | null> } {
  const models = new Map<string, CachedModel<T>>();
  async function fetchModel(src: string): Promise<T | null> {
    try {
      const response = await fetch(src, { cache: 'no-store' });
      if (!response.ok) return null;
      const value: unknown = await response.json();
      return decode(value);
    } catch {
      return null;
    }
  }
  return (relative) => {
    const src = new URL(relative, globalThis.location.href).href;
    const known = models.get(src);
    if (known !== undefined && known.expires > Date.now()) return known;
    const model = fetchModel(src);
    const entry = { model, expires: Number.POSITIVE_INFINITY };
    models.delete(src);
    models.set(src, entry);
    void model.then((loaded) => {
      if (models.get(src) !== entry) return;
      models.set(src, { ...entry, expires: Date.now() + (loaded === null ? RETRY_MS : FRESH_MS) });
      for (const [address, cached] of models) {
        if (models.size <= MAX_MODELS) break;
        if (cached.expires !== Number.POSITIVE_INFINITY) models.delete(address);
      }
    });
    return entry;
  };
}
