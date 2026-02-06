/**
 * PreviewService - Orchestration Layer
 * Coordinates artifact preview lifecycle: read file, cache, generate HTML, start server, open browser
 */

import { readFile } from 'node:fs/promises';
import open from 'open';
import type { ContentCacheInterface } from './ContentCache.js';
import type { PreviewHTMLGeneratorInterface } from './PreviewHTMLGenerator.js';
import type { PreviewHTTPServerInterface } from './PreviewHTTPServer.js';
import type { Artifact } from '../types/index.js';

/**
 * Preview error codes
 */
export type PreviewErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_ERROR'
  | 'PORT_UNAVAILABLE'
  | 'BROWSER_LAUNCH_ERROR'
  | 'UNKNOWN';

/**
 * Preview error details
 */
export interface PreviewError {
  readonly code: PreviewErrorCode;
  readonly message: string;
  readonly details?: string;
}

/**
 * Preview result (discriminated union)
 */
export type PreviewResult =
  | { readonly success: true; readonly url: string }
  | { readonly success: false; readonly error: PreviewError };

/**
 * PreviewServiceInterface defines the contract for artifact preview orchestration
 */
export interface PreviewServiceInterface {
  /**
   * Preview artifact in browser
   * @param artifact - Artifact to preview
   * @returns Result with success status and optional error
   */
  previewArtifact(artifact: Artifact): Promise<PreviewResult>;

  /**
   * Shutdown all active preview servers (cleanup)
   */
  shutdownAll(): Promise<void>;
}

/**
 * PreviewService implementation
 * Orchestrates the preview lifecycle using injected dependencies
 */
export class PreviewService implements PreviewServiceInterface {
  constructor(
    private readonly cache: ContentCacheInterface,
    private readonly generator: PreviewHTMLGeneratorInterface,
    private readonly server: PreviewHTTPServerInterface
  ) {}

  /**
   * Preview artifact in browser
   * Orchestrates: cache check → file read → cache store → HTML generation → server start → browser launch
   */
  async previewArtifact(artifact: Artifact): Promise<PreviewResult> {
    try {
      // Validate artifact path
      if (!artifact.path || artifact.path.trim() === '') {
        const result: PreviewResult = {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Artifact path is empty or invalid'
          }
        };
        this.logError(result.error, artifact);
        return result;
      }

      // Step 1: Check cache for artifact content
      let content = this.cache.get(artifact.path);

      // Step 2: Read from filesystem if cache miss
      if (content === null) {
        try {
          content = await readFile(artifact.path, 'utf-8');
          // Store in cache
          this.cache.set(artifact.path, content);
        } catch (error) {
          const result = this.handleFileError(error, artifact);
          if (!result.success) {
            this.logError(result.error, artifact);
          }
          return result;
        }
      }

      // Step 3: Generate HTML from markdown content
      const html = this.generator.generateHTML(content, artifact.name);

      // Step 4: Start HTTP server with generated HTML
      const serverResult = await this.server.start(html);

      if (!serverResult.success) {
        const result: PreviewResult = {
          success: false,
          error: {
            code: 'PORT_UNAVAILABLE',
            message: 'Cannot start preview server',
            details: serverResult.error
          }
        };
        this.logError(result.error, artifact);
        return result;
      }

      // Step 5: Launch browser with server URL
      try {
        await open(serverResult.url);
      } catch (error) {
        // Browser launch failed, but server is running
        // Return error but include URL for manual opening
        const result: PreviewResult = {
          success: false,
          error: {
            code: 'BROWSER_LAUNCH_ERROR',
            message: 'Cannot open browser. Please open manually:',
            details: serverResult.url
          }
        };
        this.logError(result.error, artifact, serverResult.url);
        return result;
      }

      // Success!
      return {
        success: true,
        url: serverResult.url
      };
    } catch (error) {
      // Catch-all for unexpected errors
      const result: PreviewResult = {
        success: false,
        error: {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
      this.logError(result.error, artifact);
      return result;
    }
  }

  /**
   * Handle file read errors and map to appropriate error codes
   */
  private handleFileError(error: unknown, _artifact: Artifact): PreviewResult {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Artifact file not found',
            details: nodeError.message
          }
        };
      }

      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        return {
          success: false,
          error: {
            code: 'FILE_READ_ERROR',
            message: 'Cannot read artifact file. Check permissions.',
            details: nodeError.message
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'FILE_READ_ERROR',
          message: 'Error reading artifact file',
          details: nodeError.message
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: 'Unknown error occurred while reading file'
      }
    };
  }

  /**
   * Log preview errors to stderr with context
   * Provides structured error information for debugging and monitoring
   */
  private logError(error: PreviewError, artifact: Artifact, url?: string): void {
    const logContext: Record<string, unknown> = {
      code: error.code,
      path: artifact.path,
      artifactName: artifact.name,
      timestamp: new Date().toISOString()
    };

    if (url) {
      logContext.url = url;
    }

    if (error.details) {
      logContext.details = error.details;
    }

    console.error('Preview error:', logContext);
  }

  /**
   * Shutdown all active preview servers (cleanup)
   */
  async shutdownAll(): Promise<void> {
    try {
      await this.server.shutdownAll();
    } catch (error) {
      // Ignore shutdown errors
      console.warn('Error during preview server shutdown:', error);
    }
  }
}
