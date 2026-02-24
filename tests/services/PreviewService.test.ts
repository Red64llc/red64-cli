/**
 * PreviewService Unit Tests
 * Requirements: 1.4, 1.5, 5.2, 5.3, 8.3 - Preview orchestration with error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewService } from '../../src/services/PreviewService.js';
import { ContentCache } from '../../src/services/ContentCache.js';
import { PreviewHTMLGenerator } from '../../src/services/PreviewHTMLGenerator.js';
import { PreviewHTTPServer } from '../../src/services/PreviewHTTPServer.js';
import type { Artifact } from '../../src/types/index.js';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('PreviewService', () => {
  let previewService: PreviewService;
  let cache: ContentCache;
  let generator: PreviewHTMLGenerator;
  let httpServer: PreviewHTTPServer;
  const testDir = '/tmp/preview-service-test';

  beforeEach(async () => {
    cache = new ContentCache();
    generator = new PreviewHTMLGenerator();
    httpServer = new PreviewHTTPServer();
    previewService = new PreviewService(cache, generator, httpServer);

    // Create test directory
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    await previewService.shutdownAll();

    // Clean up test files
    const testFiles = [
      'test-artifact.md',
      'cached-artifact.md',
      'permission-test.md',
      'error-test.md'
    ];

    for (const file of testFiles) {
      try {
        await unlink(join(testDir, file));
      } catch {
        // Ignore if file doesn't exist
      }
    }
  });

  describe('previewArtifact', () => {
    it('returns success result with URL when preview succeeds', async () => {
      const testFile = join(testDir, 'test-artifact.md');
      const content = '# Test Content\n\nThis is a test.';
      await writeFile(testFile, content, 'utf-8');

      const artifact: Artifact = {
        name: 'Test Artifact',
        filename: 'test-artifact.md',
        path: testFile,
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toMatch(/^http:\/\/localhost:\d+$/);
      }
    });

    it('uses cached content on second preview of same artifact', async () => {
      const testFile = join(testDir, 'cached-artifact.md');
      const content = '# Cached Content';
      await writeFile(testFile, content, 'utf-8');

      const artifact: Artifact = {
        name: 'Cached Artifact',
        filename: 'cached-artifact.md',
        path: testFile,
        phase: 'design-generating',
        createdAt: new Date().toISOString()
      };

      // First preview - should read from file
      const result1 = await previewService.previewArtifact(artifact);
      expect(result1.success).toBe(true);

      // Modify file after first preview
      await writeFile(testFile, '# Modified Content', 'utf-8');

      // Second preview - should use cache (still shows original content)
      const result2 = await previewService.previewArtifact(artifact);
      expect(result2.success).toBe(true);

      // Verify cache was used by checking the served content
      if (result2.success) {
        const response = await fetch(result2.url);
        const html = await response.text();
        expect(html).toContain('Cached Content');
        expect(html).not.toContain('Modified Content');
      }
    });

    it('returns FILE_NOT_FOUND error when artifact file does not exist', async () => {
      const artifact: Artifact = {
        name: 'Missing Artifact',
        filename: 'nonexistent.md',
        path: '/tmp/nonexistent-file-12345.md',
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.message).toContain('not found');
      }
    });

    it('returns FILE_NOT_FOUND error when artifact path is empty', async () => {
      const artifact: Artifact = {
        name: 'Empty Path',
        filename: 'empty.md',
        path: '',
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.message).toContain('empty or invalid');
      }
    });

    // chmod(0o000) doesn't prevent reading on Windows (NTFS ACLs work differently)
    it.skipIf(process.platform === 'win32')('returns FILE_READ_ERROR on permission denied', async () => {
      const testFile = join(testDir, 'no-permission.md');
      await writeFile(testFile, '# Content', 'utf-8');
      
      // Remove read permissions
      const fs = await import('node:fs/promises');
      await fs.chmod(testFile, 0o000);

      const artifact: Artifact = {
        name: 'No Permission',
        filename: 'no-permission.md',
        path: testFile,
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      try {
        const result = await previewService.previewArtifact(artifact);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('FILE_READ_ERROR');
          expect(result.error.message).toContain('permissions');
        }
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(testFile, 0o644);
      }
    });

    it('generates HTML from markdown content', async () => {
      const testFile = join(testDir, 'markdown-test.md');
      const content = '# Heading\n\nThis is **bold** and *italic*.';
      await writeFile(testFile, content, 'utf-8');

      const artifact: Artifact = {
        name: 'Markdown Test',
        filename: 'markdown-test.md',
        path: testFile,
        phase: 'design-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(true);
      if (result.success) {
        // Fetch and verify HTML content
        const response = await fetch(result.url);
        const html = await response.text();

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<h1');
        expect(html).toContain('Heading');
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('<em>italic</em>');
      }
    });

    it('includes artifact name in HTML title', async () => {
      const testFile = join(testDir, 'title-test.md');
      await writeFile(testFile, '# Content', 'utf-8');

      const artifact: Artifact = {
        name: 'Requirements Document',
        filename: 'title-test.md',
        path: testFile,
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = await fetch(result.url);
        const html = await response.text();

        expect(html).toContain('<title>Requirements Document</title>');
      }
    });

    it('handles Mermaid diagrams in markdown', async () => {
      const testFile = join(testDir, 'mermaid-test.md');
      const content = '# Design\n\n```mermaid\ngraph TD\n  A-->B\n```';
      await writeFile(testFile, content, 'utf-8');

      const artifact: Artifact = {
        name: 'Design with Diagram',
        filename: 'mermaid-test.md',
        path: testFile,
        phase: 'design-generating',
        createdAt: new Date().toISOString()
      };

      const result = await previewService.previewArtifact(artifact);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = await fetch(result.url);
        const html = await response.text();

        expect(html).toContain('mermaid');
        expect(html).toContain('graph TD');
      }
    });
  });

  describe('error handling', () => {
    it('logs errors to stderr with context', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const artifact: Artifact = {
        name: 'Error Test',
        filename: 'error.md',
        path: '/tmp/nonexistent-error-test.md',
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      await previewService.previewArtifact(artifact);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls[0];
      expect(logCall[0]).toBe('Preview error:');
      expect(logCall[1]).toMatchObject({
        code: 'FILE_NOT_FOUND',
        path: artifact.path,
        artifactName: artifact.name
      });

      consoleErrorSpy.mockRestore();
    });

    it('includes timestamp in error logs', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const artifact: Artifact = {
        name: 'Timestamp Test',
        filename: 'timestamp.md',
        path: '/tmp/nonexistent-timestamp.md',
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      await previewService.previewArtifact(artifact);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logContext = consoleErrorSpy.mock.calls[0][1];
      expect(logContext.timestamp).toBeDefined();
      expect(typeof logContext.timestamp).toBe('string');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('shutdownAll', () => {
    it('shuts down all active preview servers', async () => {
      const testFile1 = join(testDir, 'server1.md');
      const testFile2 = join(testDir, 'server2.md');
      await writeFile(testFile1, '# Server 1', 'utf-8');
      await writeFile(testFile2, '# Server 2', 'utf-8');

      const artifact1: Artifact = {
        name: 'Server 1',
        filename: 'server1.md',
        path: testFile1,
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      const artifact2: Artifact = {
        name: 'Server 2',
        filename: 'server2.md',
        path: testFile2,
        phase: 'design-generating',
        createdAt: new Date().toISOString()
      };

      const result1 = await previewService.previewArtifact(artifact1);
      const result2 = await previewService.previewArtifact(artifact2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Shutdown all
      await previewService.shutdownAll();

      // Servers should be inaccessible
      if (result1.success) {
        await expect(fetch(result1.url)).rejects.toThrow();
      }
      if (result2.success) {
        await expect(fetch(result2.url)).rejects.toThrow();
      }
    });

    it('handles shutdown errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw even if no servers are active
      await expect(previewService.shutdownAll()).resolves.not.toThrow();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('integration with cache', () => {
    it('stores content in cache after reading file', async () => {
      const testFile = join(testDir, 'cache-integration.md');
      const content = '# Cache Test';
      await writeFile(testFile, content, 'utf-8');

      const artifact: Artifact = {
        name: 'Cache Integration',
        filename: 'cache-integration.md',
        path: testFile,
        phase: 'requirements-generating',
        createdAt: new Date().toISOString()
      };

      // Cache should be empty initially
      expect(cache.get(testFile)).toBeNull();

      // Preview artifact
      await previewService.previewArtifact(artifact);

      // Cache should now contain content
      expect(cache.get(testFile)).toBe(content);
    });
  });

  describe('concurrent previews', () => {
    it('handles multiple concurrent preview requests', async () => {
      const testFile1 = join(testDir, 'concurrent1.md');
      const testFile2 = join(testDir, 'concurrent2.md');
      const testFile3 = join(testDir, 'concurrent3.md');

      await Promise.all([
        writeFile(testFile1, '# Concurrent 1', 'utf-8'),
        writeFile(testFile2, '# Concurrent 2', 'utf-8'),
        writeFile(testFile3, '# Concurrent 3', 'utf-8')
      ]);

      const artifacts: Artifact[] = [
        {
          name: 'Concurrent 1',
          filename: 'concurrent1.md',
          path: testFile1,
          phase: 'requirements-generating',
          createdAt: new Date().toISOString()
        },
        {
          name: 'Concurrent 2',
          filename: 'concurrent2.md',
          path: testFile2,
          phase: 'design-generating',
          createdAt: new Date().toISOString()
        },
        {
          name: 'Concurrent 3',
          filename: 'concurrent3.md',
          path: testFile3,
          phase: 'tasks-generating',
          createdAt: new Date().toISOString()
        }
      ];

      // Preview all concurrently
      const results = await Promise.all(
        artifacts.map(a => previewService.previewArtifact(a))
      );

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // All should have different URLs
      const urls = results.map(r => r.success ? r.url : '');
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(3);
    });
  });
});
