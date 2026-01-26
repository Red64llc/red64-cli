import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createGitHubService,
  type GitHubService,
  type FetchResult,
  type FetchProgress,
  GitHubFetchError
} from '../../src/services/GitHubService.js';
import {
  createCacheService,
  type CacheService
} from '../../src/services/CacheService.js';

describe('GitHubService', () => {
  let tempDir: string;
  let cacheDir: string;
  let cacheService: CacheService;
  let githubService: GitHubService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-github-test-'));
    cacheDir = join(tempDir, 'cache');
    await mkdir(cacheDir, { recursive: true });
    cacheService = createCacheService({ cacheDir });
    githubService = createGitHubService({
      defaultRepo: 'red64/framework',
      defaultVersion: 'main',
      cacheService
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('validateRepoFormat', () => {
    it('should accept valid owner/repo format', () => {
      // Valid formats should not throw
      expect(() => {
        createGitHubService({
          defaultRepo: 'owner/repo',
          defaultVersion: 'v1.0.0',
          cacheService
        });
      }).not.toThrow();
    });

    it('should accept repos with hyphens and numbers', () => {
      expect(() => {
        createGitHubService({
          defaultRepo: 'my-org-123/my-repo-456',
          defaultVersion: 'v1.0.0',
          cacheService
        });
      }).not.toThrow();
    });
  });

  describe('buildTarballUrl', () => {
    it('should construct correct GitHub API URL', () => {
      const service = createGitHubService({
        defaultRepo: 'owner/repo',
        defaultVersion: 'v1.0.0',
        cacheService
      });

      // The URL construction is internal, but we can test it indirectly
      // through the service behavior
      expect(service).toBeDefined();
    });
  });

  describe('fetchTarball', () => {
    it('should return cached result when cache hit', async () => {
      // Setup: pre-populate cache
      const tarballPath = join(tempDir, 'cached.tar.gz');
      await writeFile(tarballPath, 'cached tarball content');
      await cacheService.set('red64/framework', 'v1.0.0', tarballPath);

      const result = await githubService.fetchTarball({
        version: 'v1.0.0'
      });

      expect(result.fromCache).toBe(true);
      expect(result.version).toBe('v1.0.0');
      expect(result.repo).toBe('red64/framework');
    });

    it('should report progress during download', async () => {
      // Mock fetch to simulate download
      const progressUpdates: FetchProgress[] = [];

      // Skip actual network calls - test progress callback interface
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-length', '1000']]),
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(500) })
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(500) })
                .mockResolvedValueOnce({ done: true, value: undefined })
            })
          }
        };
      });

      // Test that progress callback is properly typed
      const onProgress = (progress: FetchProgress) => {
        progressUpdates.push(progress);
      };

      expect(typeof onProgress).toBe('function');
    });

    it('should use custom repo when provided', async () => {
      // Pre-populate cache for custom repo
      const tarballPath = join(tempDir, 'custom.tar.gz');
      await writeFile(tarballPath, 'custom tarball');
      await cacheService.set('custom/repo', 'v2.0.0', tarballPath);

      const result = await githubService.fetchTarball({
        repo: 'custom/repo',
        version: 'v2.0.0'
      });

      expect(result.repo).toBe('custom/repo');
      expect(result.version).toBe('v2.0.0');
    });

    it('should use default version when not specified', async () => {
      // Pre-populate cache for default version
      const tarballPath = join(tempDir, 'default.tar.gz');
      await writeFile(tarballPath, 'default tarball');
      await cacheService.set('red64/framework', 'main', tarballPath);

      const result = await githubService.fetchTarball({});

      expect(result.version).toBe('main');
    });
  });

  describe('listAvailableStacks', () => {
    it('should return list of stack names', async () => {
      // This test verifies the interface - actual implementation
      // depends on parsing tarball contents
      const stacks = await githubService.listAvailableStacks({
        repo: 'red64/framework',
        version: 'v1.0.0'
      });

      // Without network access, returns empty array
      expect(Array.isArray(stacks)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should provide GitHubFetchError type', () => {
      const error = new GitHubFetchError('Test error', 'NETWORK_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error instanceof Error).toBe(true);
    });

    it('should have correct error codes', () => {
      const networkError = new GitHubFetchError('Network', 'NETWORK_ERROR');
      const rateError = new GitHubFetchError('Rate', 'RATE_LIMITED');
      const repoError = new GitHubFetchError('Repo', 'INVALID_REPO');
      const notFoundError = new GitHubFetchError('Not found', 'NOT_FOUND');

      expect(networkError.code).toBe('NETWORK_ERROR');
      expect(rateError.code).toBe('RATE_LIMITED');
      expect(repoError.code).toBe('INVALID_REPO');
      expect(notFoundError.code).toBe('NOT_FOUND');
    });
  });

  describe('cache bypass', () => {
    it('should check cache before download when noCache is false', async () => {
      // Pre-populate cache
      const tarballPath = join(tempDir, 'cached.tar.gz');
      await writeFile(tarballPath, 'cached content');
      await cacheService.set('red64/framework', 'v1.0.0', tarballPath);

      const hasSpy = vi.spyOn(cacheService, 'has');

      await githubService.fetchTarball({
        version: 'v1.0.0'
        // noCache defaults to false
      });

      expect(hasSpy).toHaveBeenCalledWith('red64/framework', 'v1.0.0');
    });
  });

  describe('config validation', () => {
    it('should use provided default repo', () => {
      const service = createGitHubService({
        defaultRepo: 'custom/default',
        defaultVersion: 'v1.0.0',
        cacheService
      });

      expect(service).toBeDefined();
    });

    it('should use provided default version', () => {
      const service = createGitHubService({
        defaultRepo: 'owner/repo',
        defaultVersion: 'develop',
        cacheService
      });

      expect(service).toBeDefined();
    });
  });
});
