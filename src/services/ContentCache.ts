/**
 * ContentCache Service
 * In-memory cache for artifact file content with 5-minute TTL
 */

/**
 * Cache entry with content and timestamp
 */
interface CacheEntry {
  readonly content: string;
  readonly timestamp: number;
}

/**
 * ContentCacheInterface defines the contract for artifact content caching
 */
export interface ContentCacheInterface {
  /**
   * Get cached content if fresh (< 5 minutes old)
   * @param filePath - Absolute path to artifact file
   * @returns Cached content or null if miss/stale
   */
  get(filePath: string): string | null;

  /**
   * Store content in cache with current timestamp
   * @param filePath - Absolute path to artifact file
   * @param content - File content to cache
   */
  set(filePath: string, content: string): void;

  /**
   * Clear all cache entries
   */
  clear(): void;

  /**
   * Remove stale entries (> 5 minutes old)
   */
  prune(): void;
}

/**
 * ContentCache implementation using JavaScript Map with 5-minute TTL
 */
export class ContentCache implements ContentCacheInterface {
  private readonly cache: Map<string, CacheEntry>;
  private readonly TTL_MS = 300_000; // 5 minutes in milliseconds

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached content if fresh (< 5 minutes old)
   * Automatically prunes stale entries on each call
   */
  get(filePath: string): string | null {
    // Prune stale entries before checking
    this.prune();

    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }

    // Check if entry is still fresh
    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.cache.delete(filePath);
      return null;
    }

    return entry.content;
  }

  /**
   * Store content in cache with current timestamp
   */
  set(filePath: string, content: string): void {
    this.cache.set(filePath, {
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove stale entries (> 5 minutes old)
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}
