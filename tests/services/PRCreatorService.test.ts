/**
 * PR Creator Service Tests
 * Task 5.1: Build PR creator service for GitHub CLI operations
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  createPRCreatorService,
  type PRCreatorServiceInterface,
  type PRCreateOptions,
  type PRCreateResult
} from '../../src/services/PRCreatorService.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;

describe('PRCreatorService', () => {
  let service: PRCreatorServiceInterface;

  beforeEach(() => {
    service = createPRCreatorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to create a mock process
  function createMockProcess(
    stdout: string,
    stderr: string,
    exitCode: number
  ) {
    const mockProcess = {
      stdout: {
        on: vi.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === 'data' && stdout) {
            callback(Buffer.from(stdout));
          }
        })
      },
      stderr: {
        on: vi.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === 'data' && stderr) {
            callback(Buffer.from(stderr));
          }
        })
      },
      stdin: {
        write: vi.fn(),
        end: vi.fn()
      },
      on: vi.fn((event: string, callback: (code?: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(exitCode), 0);
        }
      })
    };
    return mockProcess;
  }

  describe('push', () => {
    it('should push branch to remote successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.push('/repo');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call git push with upstream flag', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.push('/repo', 'origin');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['push', '-u', 'origin', 'HEAD'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should return error when push fails', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'fatal: remote error', 1));

      const result = await service.push('/repo');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createPR', () => {
    beforeEach(() => {
      // Default: successful spec file reads
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('requirements.md')) {
          return Promise.resolve('# Requirements\n\nFeature requirements here');
        }
        if (path.includes('design.md')) {
          return Promise.resolve('# Design\n\nDesign overview here');
        }
        if (path.includes('tasks.md')) {
          return Promise.resolve('# Tasks\n\n- [x] Task 1\n- [x] Task 2');
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should create PR successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('https://github.com/org/repo/pull/42', '', 0));

      const options: PRCreateOptions = {
        workingDir: '/repo',
        feature: 'my-feature',
        specDir: '/repo/.red64/specs/my-feature',
        baseBranch: 'main'
      };

      const result = await service.createPR(options);

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe('https://github.com/org/repo/pull/42');
      expect(result.prNumber).toBe(42);
    });

    it('should call gh pr create with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('https://github.com/org/repo/pull/1', '', 0));

      const options: PRCreateOptions = {
        workingDir: '/repo',
        feature: 'test-feature',
        specDir: '/spec',
        baseBranch: 'main'
      };

      await service.createPR(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['pr', 'create', '--title', expect.any(String), '--base', 'main']),
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should return error when gh is not authenticated', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'error: gh auth login required', 1));

      const options: PRCreateOptions = {
        workingDir: '/repo',
        feature: 'feature',
        specDir: '/spec',
        baseBranch: 'main'
      };

      const result = await service.createPR(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('auth');
    });

    it('should extract PR number from URL', async () => {
      mockSpawn.mockReturnValue(createMockProcess('https://github.com/user/repo/pull/123', '', 0));

      const options: PRCreateOptions = {
        workingDir: '/repo',
        feature: 'feature',
        specDir: '/spec',
        baseBranch: 'main'
      };

      const result = await service.createPR(options);

      expect(result.prNumber).toBe(123);
    });
  });

  describe('generatePRBody', () => {
    beforeEach(() => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('requirements.md')) {
          return Promise.resolve('# Requirements\n\nAs a user, I want feature X');
        }
        if (path.includes('design.md')) {
          return Promise.resolve('# Design\n\n## Overview\nDesign details');
        }
        if (path.includes('tasks.md')) {
          return Promise.resolve('# Tasks\n\n- [x] 1.1 First task\n- [x] 1.2 Second task');
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should read spec artifacts and generate PR body', async () => {
      const body = await service.generatePRBody('/spec', 'my-feature');

      expect(body).toContain('my-feature');
      expect(body).toContain('Summary');
      expect(body).toContain('Design');
      expect(body).toContain('Tasks');
    });

    it('should include links to spec artifacts', async () => {
      const body = await service.generatePRBody('/spec', 'feature');

      expect(body).toContain('requirements.md');
      expect(body).toContain('design.md');
      expect(body).toContain('tasks.md');
    });

    it('should handle missing spec files gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const body = await service.generatePRBody('/spec', 'feature');

      // Should still generate a body, just without content
      expect(body).toContain('feature');
    });
  });

  describe('error handling', () => {
    it('should handle gh not found error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: (err?: Error | number) => void) => {
          if (event === 'error') {
            callback(new Error('spawn gh ENOENT'));
          }
        })
      };
      mockSpawn.mockReturnValue(mockProcess);

      const options: PRCreateOptions = {
        workingDir: '/repo',
        feature: 'feature',
        specDir: '/spec',
        baseBranch: 'main'
      };

      const result = await service.createPR(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('gh');
    });
  });
});
