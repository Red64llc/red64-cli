import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir, homedir, platform } from 'node:os';
import { join } from 'node:path';

// Import will be created in implementation
import {
  createCacheService,
  type CacheService,
  type CacheEntry
} from '../../src/services/CacheService.js';

describe('CacheService', () => {
  let tempDir: string;
  let cacheService: CacheService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-cache-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('getCacheDir', () => {
    it('should return platform-appropriate cache directory path', () => {
      cacheService = createCacheService();
      const cacheDir = cacheService.getCacheDir();

      // Should be a string path
      expect(typeof cacheDir).toBe('string');
      expect(cacheDir.length).toBeGreaterThan(0);

      // Should contain red64 in the path
      expect(cacheDir).toContain('red64');
    });

    it('should return macOS-specific path on darwin platform', () => {
      // Mock platform detection
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

      cacheService = createCacheService();
      const cacheDir = cacheService.getCacheDir();

      // macOS uses ~/Library/Caches/red64
      expect(cacheDir).toContain('Library');
      expect(cacheDir).toContain('Caches');
    });

    it('should return Linux-specific path on linux platform', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      // Ensure XDG_CACHE_HOME is not set for default behavior
      const originalEnv = process.env.XDG_CACHE_HOME;
      delete process.env.XDG_CACHE_HOME;

      cacheService = createCacheService();
      const cacheDir = cacheService.getCacheDir();

      // Linux uses $XDG_CACHE_HOME/red64 or ~/.cache/red64
      expect(cacheDir).toContain('.cache');

      // Restore env
      if (originalEnv) {
        process.env.XDG_CACHE_HOME = originalEnv;
      }
    });

    it('should respect XDG_CACHE_HOME on Linux', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const customCacheHome = '/custom/cache/dir';
      process.env.XDG_CACHE_HOME = customCacheHome;

      cacheService = createCacheService();
      const cacheDir = cacheService.getCacheDir();

      expect(cacheDir).toBe(join(customCacheHome, 'red64'));

      // Cleanup
      delete process.env.XDG_CACHE_HOME;
    });

    it('should return Windows-specific path on win32 platform', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

      cacheService = createCacheService();
      const cacheDir = cacheService.getCacheDir();

      // Windows uses %LOCALAPPDATA%/red64
      expect(cacheDir).toContain('AppData');
      expect(cacheDir).toContain('Local');

      // Cleanup
      delete process.env.LOCALAPPDATA;
    });

    it('should use temp-based fallback directory when provided', () => {
      // Testing the fallback behavior through custom config
      // The actual homedir() fallback is internal implementation detail
      const fallbackDir = join(tmpdir(), 'red64-cache-fallback');
      cacheService = createCacheService({ cacheDir: fallbackDir });
      const cacheDir = cacheService.getCacheDir();

      expect(cacheDir).toBe(fallbackDir);
      expect(cacheDir).toContain(tmpdir());
    });

    it('should allow custom cache directory override', () => {
      const customDir = join(tempDir, 'custom-cache');
      cacheService = createCacheService({ cacheDir: customDir });
      const cacheDir = cacheService.getCacheDir();

      expect(cacheDir).toBe(customDir);
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      cacheService = createCacheService({ cacheDir: tempDir });
    });

    it('should return false when no cache entry exists', async () => {
      const result = await cacheService.has('owner/repo', 'v1.0.0');
      expect(result).toBe(false);
    });

    it('should return true when valid cache entry exists', async () => {
      // Setup: create a cached tarball and metadata
      const tarballPath = join(tempDir, 'owner-repo-v1.0.0.tar.gz');
      await writeFile(tarballPath, 'fake tarball content');

      // Store in cache
      await cacheService.set('owner/repo', 'v1.0.0', tarballPath);

      const result = await cacheService.has('owner/repo', 'v1.0.0');
      expect(result).toBe(true);
    });

    it('should return false when metadata exists but file is missing', async () => {
      // Create only the metadata without the actual file
      const cacheMetaPath = join(tempDir, 'cache.json');
      const metadata = {
        entries: [{
          repo: 'owner/repo',
          version: 'v1.0.0',
          path: join(tempDir, 'nonexistent.tar.gz'),
          cachedAt: new Date().toISOString(),
          size: 100
        }]
      };
      await writeFile(cacheMetaPath, JSON.stringify(metadata));

      const result = await cacheService.has('owner/repo', 'v1.0.0');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      cacheService = createCacheService({ cacheDir: tempDir });
    });

    it('should throw when cache entry does not exist', async () => {
      await expect(cacheService.get('owner/repo', 'v1.0.0'))
        .rejects.toThrow('Cache entry not found');
    });

    it('should return cache entry when it exists', async () => {
      const tarballPath = join(tempDir, 'test-tarball.tar.gz');
      const content = 'fake tarball content for testing';
      await writeFile(tarballPath, content);

      await cacheService.set('owner/repo', 'v1.0.0', tarballPath);

      const entry = await cacheService.get('owner/repo', 'v1.0.0');

      expect(entry.repo).toBe('owner/repo');
      expect(entry.version).toBe('v1.0.0');
      expect(entry.size).toBe(content.length);
      expect(typeof entry.cachedAt).toBe('string');
      expect(entry.path).toBeTruthy();
    });

    it('should throw when file is missing despite metadata', async () => {
      // Create metadata pointing to non-existent file
      const cacheMetaPath = join(tempDir, 'cache.json');
      const metadata = {
        entries: [{
          repo: 'owner/repo',
          version: 'v1.0.0',
          path: join(tempDir, 'nonexistent.tar.gz'),
          cachedAt: new Date().toISOString(),
          size: 100
        }]
      };
      await writeFile(cacheMetaPath, JSON.stringify(metadata));

      await expect(cacheService.get('owner/repo', 'v1.0.0'))
        .rejects.toThrow('Cache entry not found');
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      cacheService = createCacheService({ cacheDir: tempDir });
    });

    it('should store tarball and update metadata', async () => {
      const sourcePath = join(tempDir, 'source-tarball.tar.gz');
      const content = 'tarball content';
      await writeFile(sourcePath, content);

      const entry = await cacheService.set('owner/repo', 'v1.0.0', sourcePath);

      expect(entry.repo).toBe('owner/repo');
      expect(entry.version).toBe('v1.0.0');
      expect(entry.size).toBe(content.length);

      // Verify the cache metadata was updated
      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      expect(meta.entries).toHaveLength(1);
      expect(meta.entries[0].repo).toBe('owner/repo');
    });

    it('should copy tarball to cache directory', async () => {
      const sourcePath = join(tempDir, 'source', 'tarball.tar.gz');
      await mkdir(join(tempDir, 'source'), { recursive: true });
      await writeFile(sourcePath, 'tarball content');

      const entry = await cacheService.set('owner/repo', 'v1.0.0', sourcePath);

      // Should have copied to cache location
      const cachedContent = await readFile(entry.path, 'utf-8');
      expect(cachedContent).toBe('tarball content');
    });

    it('should update existing entry for same repo/version', async () => {
      const path1 = join(tempDir, 'tarball1.tar.gz');
      const path2 = join(tempDir, 'tarball2.tar.gz');
      await writeFile(path1, 'content 1');
      await writeFile(path2, 'content 2 longer');

      await cacheService.set('owner/repo', 'v1.0.0', path1);
      const entry = await cacheService.set('owner/repo', 'v1.0.0', path2);

      // Should have the new size
      expect(entry.size).toBe('content 2 longer'.length);

      // Metadata should only have one entry
      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      expect(meta.entries).toHaveLength(1);
    });

    it('should handle multiple different repo/version combinations', async () => {
      const path1 = join(tempDir, 'tarball1.tar.gz');
      const path2 = join(tempDir, 'tarball2.tar.gz');
      await writeFile(path1, 'content 1');
      await writeFile(path2, 'content 2');

      await cacheService.set('owner/repo1', 'v1.0.0', path1);
      await cacheService.set('owner/repo2', 'v2.0.0', path2);

      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      expect(meta.entries).toHaveLength(2);
    });
  });

  describe('prune', () => {
    beforeEach(async () => {
      cacheService = createCacheService({ cacheDir: tempDir });
    });

    it('should remove entries older than maxAge', async () => {
      // Create a tarball and set it
      const tarballPath = join(tempDir, 'old-tarball.tar.gz');
      await writeFile(tarballPath, 'old content');
      await cacheService.set('owner/repo', 'v1.0.0', tarballPath);

      // Manually modify the cachedAt to be old
      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      meta.entries[0].cachedAt = oldDate;
      await writeFile(cacheMetaPath, JSON.stringify(meta));

      // Prune with 30 minute maxAge
      const removed = await cacheService.prune(30 * 60 * 1000);

      expect(removed).toBe(1);
      expect(await cacheService.has('owner/repo', 'v1.0.0')).toBe(false);
    });

    it('should keep entries newer than maxAge', async () => {
      const tarballPath = join(tempDir, 'new-tarball.tar.gz');
      await writeFile(tarballPath, 'new content');
      await cacheService.set('owner/repo', 'v1.0.0', tarballPath);

      // Prune with 1 hour maxAge (entry was just created)
      const removed = await cacheService.prune(60 * 60 * 1000);

      expect(removed).toBe(0);
      expect(await cacheService.has('owner/repo', 'v1.0.0')).toBe(true);
    });

    it('should return count of removed entries', async () => {
      const path1 = join(tempDir, 'tarball1.tar.gz');
      const path2 = join(tempDir, 'tarball2.tar.gz');
      await writeFile(path1, 'content 1');
      await writeFile(path2, 'content 2');

      await cacheService.set('owner/repo1', 'v1.0.0', path1);
      await cacheService.set('owner/repo2', 'v1.0.0', path2);

      // Mark both as old
      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      meta.entries.forEach((e: CacheEntry) => { e.cachedAt = oldDate; });
      await writeFile(cacheMetaPath, JSON.stringify(meta));

      const removed = await cacheService.prune(60 * 60 * 1000);

      expect(removed).toBe(2);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      cacheService = createCacheService({ cacheDir: tempDir });
    });

    it('should remove all cache entries', async () => {
      const path1 = join(tempDir, 'tarball1.tar.gz');
      const path2 = join(tempDir, 'tarball2.tar.gz');
      await writeFile(path1, 'content 1');
      await writeFile(path2, 'content 2');

      await cacheService.set('owner/repo1', 'v1.0.0', path1);
      await cacheService.set('owner/repo2', 'v1.0.0', path2);

      await cacheService.clear();

      expect(await cacheService.has('owner/repo1', 'v1.0.0')).toBe(false);
      expect(await cacheService.has('owner/repo2', 'v1.0.0')).toBe(false);
    });

    it('should not throw when cache is already empty', async () => {
      await expect(cacheService.clear()).resolves.not.toThrow();
    });

    it('should reset cache metadata', async () => {
      const tarballPath = join(tempDir, 'tarball.tar.gz');
      await writeFile(tarballPath, 'content');
      await cacheService.set('owner/repo', 'v1.0.0', tarballPath);

      await cacheService.clear();

      const cacheMetaPath = join(tempDir, 'cache.json');
      const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
      expect(meta.entries).toHaveLength(0);
    });
  });
});
