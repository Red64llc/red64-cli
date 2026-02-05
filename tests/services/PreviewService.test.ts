/**
 * Unit tests for PreviewService (orchestration layer)
 * Tests artifact preview lifecycle with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreviewService } from '../../src/services/PreviewService.js';
import type { ContentCacheInterface } from '../../src/services/ContentCache.js';
import type { PreviewHTMLGeneratorInterface } from '../../src/services/PreviewHTMLGenerator.js';
import type { PreviewHTTPServerInterface, ServerStartResult } from '../../src/services/PreviewHTTPServer.js';
import type { Artifact } from '../../src/types/index.js';

// Mock implementations
const createMockCache = (): ContentCacheInterface => ({
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  prune: vi.fn()
});

const createMockGenerator = (): PreviewHTMLGeneratorInterface => ({
  generateHTML: vi.fn()
});

const createMockHTTPServer = (): PreviewHTTPServerInterface => ({
  start: vi.fn(),
  shutdown: vi.fn(),
  shutdownAll: vi.fn()
});

const mockOpen = vi.fn();

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}));

// Mock open library
vi.mock('open', () => ({
  default: vi.fn()
}));

describe('PreviewService', () => {
  let service: PreviewService;
  let mockCache: ContentCacheInterface;
  let mockGenerator: PreviewHTMLGeneratorInterface;
  let mockServer: PreviewHTTPServerInterface;

  beforeEach(async () => {
    mockCache = createMockCache();
    mockGenerator = createMockGenerator();
    mockServer = createMockHTTPServer();

    // Reset mocks
    vi.clearAllMocks();
    mockOpen.mockClear();

    // Set up default mock implementations
    vi.mocked(mockCache.get).mockReturnValue(null);
    vi.mocked(mockGenerator.generateHTML).mockReturnValue('<html><body>Generated HTML</body></html>');
    vi.mocked(mockServer.start).mockResolvedValue({
      success: true,
      url: 'http://localhost:3000',
      port: 3000
    });

    // Import and mock open
    const openModule = await import('open');
    vi.mocked(openModule.default).mockResolvedValue(undefined as any);

    service = new PreviewService(mockCache, mockGenerator, mockServer);
  });

  describe('previewArtifact', () => {
    const testArtifact: Artifact = {
      name: 'Requirements',
      filename: 'requirements.md',
      path: '/workspace/.red64/specs/test-feature/requirements.md',
      phase: 'requirements-generating',
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    it('should return success result with URL when preview succeeds', async () => {
      // Mock file read
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toBe('http://localhost:3000');
      }
    });

    it('should check cache before reading file (cache hit)', async () => {
      vi.mocked(mockCache.get).mockReturnValue('# Cached Content');

      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('Should not be called');

      await service.previewArtifact(testArtifact);

      expect(mockCache.get).toHaveBeenCalledWith(testArtifact.path);
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should read file and cache on cache miss', async () => {
      vi.mocked(mockCache.get).mockReturnValue(null);

      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Fresh Content');

      await service.previewArtifact(testArtifact);

      expect(mockCache.get).toHaveBeenCalledWith(testArtifact.path);
      expect(readFile).toHaveBeenCalledWith(testArtifact.path, 'utf-8');
      expect(mockCache.set).toHaveBeenCalledWith(testArtifact.path, '# Fresh Content');
    });

    it('should generate HTML with artifact content and name', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      await service.previewArtifact(testArtifact);

      expect(mockGenerator.generateHTML).toHaveBeenCalledWith('# Test Content', 'Requirements');
    });

    it('should start HTTP server with generated HTML', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      await service.previewArtifact(testArtifact);

      expect(mockServer.start).toHaveBeenCalledWith('<html><body>Generated HTML</body></html>');
    });

    it('should launch browser with server URL', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      const openModule = await import('open');

      await service.previewArtifact(testArtifact);

      expect(openModule.default).toHaveBeenCalledWith('http://localhost:3000');
    });

    it('should return FILE_NOT_FOUND error when file does not exist', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('ENOENT: no such file or directory') as any;
      error.code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return FILE_READ_ERROR when file read fails', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('Permission denied') as any;
      error.code = 'EACCES';
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_READ_ERROR');
        expect(result.error.message).toContain('Cannot read');
      }
    });

    it('should return PORT_UNAVAILABLE error when server start fails', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      vi.mocked(mockServer.start).mockResolvedValue({
        success: false,
        error: 'All ports busy'
      });

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PORT_UNAVAILABLE');
      }
    });

    it('should return BROWSER_LAUNCH_ERROR when browser fails to open', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      const openModule = await import('open');
      vi.mocked(openModule.default).mockRejectedValue(new Error('Browser not found'));

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('BROWSER_LAUNCH_ERROR');
        expect(result.error.details).toBe('http://localhost:3000');
      }
    });

    it('should handle path validation', async () => {
      const invalidArtifact: Artifact = {
        name: 'Invalid',
        filename: 'invalid.md',
        path: '', // Empty path
        phase: 'requirements-generating',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const result = await service.previewArtifact(invalidArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('shutdownAll', () => {
    it('should delegate to HTTP server shutdownAll', async () => {
      await service.shutdownAll();

      expect(mockServer.shutdownAll).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockServer.shutdownAll).mockRejectedValue(new Error('Shutdown failed'));

      // Should not throw
      await expect(service.shutdownAll()).resolves.not.toThrow();
    });
  });

  describe('error logging', () => {
    const testArtifact: Artifact = {
      name: 'Requirements',
      filename: 'requirements.md',
      path: '/workspace/.red64/specs/test-feature/requirements.md',
      phase: 'requirements-generating',
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log FILE_NOT_FOUND errors to stderr with context', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('ENOENT: no such file or directory') as any;
      error.code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      await service.previewArtifact(testArtifact);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preview error'),
        expect.objectContaining({
          code: 'FILE_NOT_FOUND',
          path: testArtifact.path,
          artifactName: testArtifact.name
        })
      );
    });

    it('should log FILE_READ_ERROR errors to stderr with context', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('Permission denied') as any;
      error.code = 'EACCES';
      vi.mocked(readFile).mockRejectedValue(error);

      await service.previewArtifact(testArtifact);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preview error'),
        expect.objectContaining({
          code: 'FILE_READ_ERROR',
          path: testArtifact.path
        })
      );
    });

    it('should log PORT_UNAVAILABLE errors to stderr', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      vi.mocked(mockServer.start).mockResolvedValue({
        success: false,
        error: 'All ports busy'
      });

      await service.previewArtifact(testArtifact);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preview error'),
        expect.objectContaining({
          code: 'PORT_UNAVAILABLE'
        })
      );
    });

    it('should log BROWSER_LAUNCH_ERROR errors to stderr with URL', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockResolvedValue('# Test Content');

      const openModule = await import('open');
      vi.mocked(openModule.default).mockRejectedValue(new Error('Browser not found'));

      await service.previewArtifact(testArtifact);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preview error'),
        expect.objectContaining({
          code: 'BROWSER_LAUNCH_ERROR',
          url: 'http://localhost:3000'
        })
      );
    });

    it('should include timestamp in error logs', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      const now = new Date();
      vi.setSystemTime(now);

      await service.previewArtifact(testArtifact);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('edge cases', () => {
    const testArtifact: Artifact = {
      name: 'Requirements',
      filename: 'requirements.md',
      path: '/workspace/.red64/specs/test-feature/requirements.md',
      phase: 'requirements-generating',
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    it('should handle file deletion between cache check and read', async () => {
      vi.mocked(mockCache.get).mockReturnValue(null);

      const { readFile } = await import('node:fs/promises');
      const error = new Error('ENOENT: file was deleted') as any;
      error.code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should handle EPERM error code for permission issues', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('Operation not permitted') as any;
      error.code = 'EPERM';
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_READ_ERROR');
        expect(result.error.message).toContain('Check permissions');
      }
    });

    it('should handle whitespace-only path as invalid', async () => {
      const invalidArtifact: Artifact = {
        name: 'Invalid',
        filename: 'invalid.md',
        path: '   ', // Whitespace only
        phase: 'requirements-generating',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const result = await service.previewArtifact(invalidArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
      }
    });

    it('should handle non-Error thrown objects', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockRejectedValue('String error');

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
      }
    });

    it('should handle null error code in file errors', async () => {
      const { readFile } = await import('node:fs/promises');
      const error = new Error('Unknown file error') as any;
      error.code = null;
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await service.previewArtifact(testArtifact);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_READ_ERROR');
      }
    });
  });
});
