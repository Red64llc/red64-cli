/**
 * Cache service for offline download caching
 * Requirements: 6.5, 6.6
 */

import { mkdir, readFile, writeFile, rm, access, copyFile, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  readonly repo: string;
  readonly version: string;
  readonly path: string;
  readonly cachedAt: string;
  readonly size: number;
}

/**
 * Cache metadata file structure
 */
interface CacheMetadata {
  entries: CacheEntry[];
}

/**
 * Cache service configuration
 */
export interface CacheServiceConfig {
  readonly cacheDir?: string;
}

/**
 * Cache service interface
 * Requirements: 6.5-6.8
 */
export interface CacheService {
  /**
   * Get cache directory path (platform-specific)
   */
  getCacheDir(): string;

  /**
   * Check if valid cache entry exists for version
   */
  has(repo: string, version: string): Promise<boolean>;

  /**
   * Get cached tarball path
   * @throws CacheError if entry does not exist
   */
  get(repo: string, version: string): Promise<CacheEntry>;

  /**
   * Store tarball in cache
   */
  set(repo: string, version: string, tarballPath: string): Promise<CacheEntry>;

  /**
   * Clear cache entries older than maxAge
   */
  prune(maxAgeMs: number): Promise<number>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;
}

/**
 * Get platform-specific cache directory
 * Task 1.1: Platform-specific cache directory resolution
 */
function getPlatformCacheDir(): string {
  const currentPlatform = process.platform;

  try {
    const home = homedir();

    switch (currentPlatform) {
      case 'darwin':
        // macOS: ~/Library/Caches/red64
        return join(home, 'Library', 'Caches', 'red64');

      case 'linux':
        // Linux: $XDG_CACHE_HOME/red64 or ~/.cache/red64
        const xdgCacheHome = process.env.XDG_CACHE_HOME;
        if (xdgCacheHome) {
          return join(xdgCacheHome, 'red64');
        }
        return join(home, '.cache', 'red64');

      case 'win32':
        // Windows: %LOCALAPPDATA%/red64
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
          return join(localAppData, 'red64');
        }
        return join(home, 'AppData', 'Local', 'red64');

      default:
        // Unknown platform: use home-based cache
        return join(home, '.cache', 'red64');
    }
  } catch {
    // Fallback to temp directory when home cannot be determined
    return join(tmpdir(), 'red64-cache');
  }
}

/**
 * Get cache metadata file path
 */
function getCacheMetaPath(cacheDir: string): string {
  return join(cacheDir, 'cache.json');
}

/**
 * Generate tarball filename from repo and version
 */
function getTarballFilename(repo: string, version: string): string {
  // Convert owner/repo to owner-repo for filename
  const safeRepo = repo.replace('/', '-');
  return `${safeRepo}-${version}.tar.gz`;
}

/**
 * Load cache metadata
 */
async function loadMetadata(cacheDir: string): Promise<CacheMetadata> {
  const metaPath = getCacheMetaPath(cacheDir);
  try {
    const content = await readFile(metaPath, 'utf-8');
    return JSON.parse(content) as CacheMetadata;
  } catch {
    return { entries: [] };
  }
}

/**
 * Save cache metadata
 */
async function saveMetadata(cacheDir: string, metadata: CacheMetadata): Promise<void> {
  const metaPath = getCacheMetaPath(cacheDir);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Find entry in metadata
 */
function findEntry(metadata: CacheMetadata, repo: string, version: string): CacheEntry | undefined {
  return metadata.entries.find(
    entry => entry.repo === repo && entry.version === version
  );
}

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create cache service
 * Task 1.1, 1.2: Cache service factory with platform detection and entry management
 */
export function createCacheService(config: CacheServiceConfig = {}): CacheService {
  const cacheDir = config.cacheDir ?? getPlatformCacheDir();

  return {
    getCacheDir(): string {
      return cacheDir;
    },

    async has(repo: string, version: string): Promise<boolean> {
      const metadata = await loadMetadata(cacheDir);
      const entry = findEntry(metadata, repo, version);

      if (!entry) {
        return false;
      }

      // Verify the file actually exists
      return fileExists(entry.path);
    },

    async get(repo: string, version: string): Promise<CacheEntry> {
      const metadata = await loadMetadata(cacheDir);
      const entry = findEntry(metadata, repo, version);

      if (!entry) {
        throw new Error('Cache entry not found');
      }

      // Verify the file exists
      const exists = await fileExists(entry.path);
      if (!exists) {
        throw new Error('Cache entry not found');
      }

      return entry;
    },

    async set(repo: string, version: string, tarballPath: string): Promise<CacheEntry> {
      // Ensure cache directory exists
      await mkdir(cacheDir, { recursive: true });

      // Get file stats
      const stats = await stat(tarballPath);
      const size = stats.size;

      // Determine destination path
      const filename = getTarballFilename(repo, version);
      const destPath = join(cacheDir, filename);

      // Copy tarball to cache directory (if not already there)
      if (tarballPath !== destPath) {
        await copyFile(tarballPath, destPath);
      }

      // Create entry
      const entry: CacheEntry = {
        repo,
        version,
        path: destPath,
        cachedAt: new Date().toISOString(),
        size
      };

      // Update metadata
      const metadata = await loadMetadata(cacheDir);
      const existingIndex = metadata.entries.findIndex(
        e => e.repo === repo && e.version === version
      );

      if (existingIndex >= 0) {
        // Update existing entry
        metadata.entries[existingIndex] = entry;
      } else {
        // Add new entry
        metadata.entries.push(entry);
      }

      await saveMetadata(cacheDir, metadata);

      return entry;
    },

    async prune(maxAgeMs: number): Promise<number> {
      const metadata = await loadMetadata(cacheDir);
      const now = Date.now();
      const cutoff = now - maxAgeMs;

      let removedCount = 0;
      const remainingEntries: CacheEntry[] = [];

      for (const entry of metadata.entries) {
        const cachedTime = new Date(entry.cachedAt).getTime();
        if (cachedTime < cutoff) {
          // Remove old entry
          try {
            await rm(entry.path, { force: true });
          } catch {
            // Ignore removal errors
          }
          removedCount++;
        } else {
          remainingEntries.push(entry);
        }
      }

      // Update metadata with remaining entries
      metadata.entries = remainingEntries;
      await saveMetadata(cacheDir, metadata);

      return removedCount;
    },

    async clear(): Promise<void> {
      const metadata = await loadMetadata(cacheDir);

      // Remove all cached files
      for (const entry of metadata.entries) {
        try {
          await rm(entry.path, { force: true });
        } catch {
          // Ignore removal errors
        }
      }

      // Reset metadata
      metadata.entries = [];
      await saveMetadata(cacheDir, metadata);
    }
  };
}
