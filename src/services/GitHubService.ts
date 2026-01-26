/**
 * GitHub service for tarball fetching
 * Requirements: 6.1-6.4
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CacheService } from './CacheService.js';

/**
 * GitHub service configuration
 */
export interface GitHubServiceConfig {
  readonly defaultRepo: string;
  readonly defaultVersion: string;
  readonly cacheService: CacheService;
}

/**
 * Fetch options
 */
export interface FetchOptions {
  readonly repo?: string;
  readonly version?: string;
  readonly onProgress?: (progress: FetchProgress) => void;
  readonly noCache?: boolean;
}

/**
 * Fetch progress information
 */
export interface FetchProgress {
  readonly phase: 'connecting' | 'downloading' | 'caching';
  readonly bytesReceived?: number;
  readonly totalBytes?: number;
}

/**
 * Fetch result
 */
export interface FetchResult {
  readonly tarballPath: string;
  readonly version: string;
  readonly repo: string;
  readonly fromCache: boolean;
}

/**
 * Error codes for GitHub fetch operations
 */
export type GitHubErrorCode =
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_REPO'
  | 'NOT_FOUND'
  | 'EXTRACTION_ERROR';

/**
 * Custom error for GitHub fetch operations
 */
export class GitHubFetchError extends Error {
  readonly code: GitHubErrorCode;

  constructor(message: string, code: GitHubErrorCode) {
    super(message);
    this.name = 'GitHubFetchError';
    this.code = code;
  }
}

/**
 * GitHub service interface
 * Requirements: 6.1-6.4
 */
export interface GitHubService {
  /**
   * Fetch framework tarball from GitHub
   * @throws GitHubFetchError on network failure, invalid repo, or rate limiting
   */
  fetchTarball(options: FetchOptions): Promise<FetchResult>;

  /**
   * List available stacks from repository
   * @throws GitHubFetchError on network failure
   */
  listAvailableStacks(options: Pick<FetchOptions, 'repo' | 'version'>): Promise<readonly string[]>;
}

/**
 * Validate repository format (owner/repo)
 */
function validateRepoFormat(repo: string): void {
  const repoPattern = /^[\w-]+\/[\w-]+$/;
  if (!repoPattern.test(repo)) {
    throw new GitHubFetchError(
      `Invalid repository format: "${repo}". Expected format: owner/repo`,
      'INVALID_REPO'
    );
  }
}

/**
 * Build GitHub tarball URL
 */
function buildTarballUrl(repo: string, version: string): string {
  return `https://api.github.com/repos/${repo}/tarball/${version}`;
}

/**
 * Create GitHub service
 * Task 2.1, 2.2, 2.3: GitHub service factory
 */
export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const { defaultRepo, defaultVersion, cacheService } = config;

  // Validate default repo format
  validateRepoFormat(defaultRepo);

  return {
    async fetchTarball(options: FetchOptions): Promise<FetchResult> {
      const repo = options.repo ?? defaultRepo;
      const version = options.version ?? defaultVersion;
      const noCache = options.noCache ?? false;
      const onProgress = options.onProgress;

      // Validate repo format if custom repo provided
      if (options.repo) {
        validateRepoFormat(options.repo);
      }

      // Check cache first (unless bypassed)
      if (!noCache) {
        const hasCache = await cacheService.has(repo, version);
        if (hasCache) {
          const entry = await cacheService.get(repo, version);
          return {
            tarballPath: entry.path,
            version,
            repo,
            fromCache: true
          };
        }
      }

      // Report connecting phase
      onProgress?.({ phase: 'connecting' });

      // Build URL and fetch
      const url = buildTarballUrl(repo, version);

      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'red64-cli'
          },
          redirect: 'follow'
        });

        // Handle error responses
        if (!response.ok) {
          if (response.status === 404) {
            throw new GitHubFetchError(
              `Repository or version not found: ${repo}@${version}`,
              'NOT_FOUND'
            );
          }
          if (response.status === 403 || response.status === 429) {
            throw new GitHubFetchError(
              'GitHub API rate limit exceeded. Try again later or use cached version.',
              'RATE_LIMITED'
            );
          }
          throw new GitHubFetchError(
            `GitHub API error: ${response.status} ${response.statusText}`,
            'NETWORK_ERROR'
          );
        }

        // Get content length for progress
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

        // Report downloading phase
        onProgress?.({ phase: 'downloading', bytesReceived: 0, totalBytes });

        // Read response body
        const reader = response.body?.getReader();
        if (!reader) {
          throw new GitHubFetchError(
            'Failed to read response body',
            'NETWORK_ERROR'
          );
        }

        const chunks: Uint8Array[] = [];
        let bytesReceived = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          bytesReceived += value.length;

          onProgress?.({
            phase: 'downloading',
            bytesReceived,
            totalBytes
          });
        }

        // Combine chunks
        const tarball = new Uint8Array(bytesReceived);
        let offset = 0;
        for (const chunk of chunks) {
          tarball.set(chunk, offset);
          offset += chunk.length;
        }

        // Report caching phase
        onProgress?.({ phase: 'caching' });

        // Write to temp file
        const tempDir = cacheService.getCacheDir();
        await mkdir(tempDir, { recursive: true });
        const tempPath = join(tempDir, `${repo.replace('/', '-')}-${version}.tar.gz`);
        await writeFile(tempPath, tarball);

        // Store in cache
        const entry = await cacheService.set(repo, version, tempPath);

        return {
          tarballPath: entry.path,
          version,
          repo,
          fromCache: false
        };
      } catch (error) {
        if (error instanceof GitHubFetchError) {
          throw error;
        }

        // Handle network errors
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new GitHubFetchError(
          `Network error fetching tarball: ${message}`,
          'NETWORK_ERROR'
        );
      }
    },

    async listAvailableStacks(_options: Pick<FetchOptions, 'repo' | 'version'>): Promise<readonly string[]> {
      // This would require fetching and parsing the tarball
      // For now, return empty array - full implementation requires tarball extraction
      // The actual stack listing happens after extraction via TemplateService
      return [];
    }
  };
}
