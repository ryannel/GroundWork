import fs from "node:fs";
import yaml from "js-yaml";

interface CacheEntry<T> {
  readonly mtimeMs: number;
  readonly size: number;
  readonly value: T;
}

/**
 * Per-file incremental parse cache keyed by (absPath, mtimeMs, size).
 * Keeps repeated reads of 100+ system workspaces sub-50ms.
 */
export class IncrementalFileCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  public hits = 0;
  public misses = 0;

  readYaml<T = unknown>(absPath: string): T | undefined {
    if (!fs.existsSync(absPath)) return undefined;
    const stat = fs.statSync(absPath);
    const cached = this.store.get(absPath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      this.hits++;
      return cached.value as T;
    }
    this.misses++;
    const raw = fs.readFileSync(absPath, "utf8");
    const parsed = yaml.load(raw) as T;
    this.store.set(absPath, { mtimeMs: stat.mtimeMs, size: stat.size, value: parsed });
    return parsed;
  }

  readJson<T = unknown>(absPath: string): T | undefined {
    if (!fs.existsSync(absPath)) return undefined;
    const stat = fs.statSync(absPath);
    const cached = this.store.get(absPath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      this.hits++;
      return cached.value as T;
    }
    this.misses++;
    const raw = fs.readFileSync(absPath, "utf8");
    const parsed = JSON.parse(raw) as T;
    this.store.set(absPath, { mtimeMs: stat.mtimeMs, size: stat.size, value: parsed });
    return parsed;
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

export const defaultFileCache = new IncrementalFileCache();
