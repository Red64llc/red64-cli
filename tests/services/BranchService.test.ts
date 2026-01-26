/**
 * BranchService Tests
 * Task 1.3: Implement branch management service
 * Requirements: 4.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createBranchService,
  type BranchServiceInterface,
  type BranchDeleteResult
} from '../../src/services/BranchService.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;

describe('BranchService', () => {
  let service: BranchServiceInterface;

  beforeEach(() => {
    service = createBranchService();
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
      on: vi.fn((event: string, callback: (code?: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(exitCode), 0);
        }
      })
    };
    return mockProcess;
  }

  describe('deleteLocal', () => {
    it('should delete local branch successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('Deleted branch feature/test', '', 0));

      const result = await service.deleteLocal('feature/test');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call git with -d flag by default', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.deleteLocal('feature/my-feature');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['branch', '-d', 'feature/my-feature'],
        expect.any(Object)
      );
    });

    it('should call git with -D flag when force is true', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.deleteLocal('feature/dirty-branch', true);

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['branch', '-D', 'feature/dirty-branch'],
        expect.any(Object)
      );
    });

    it('should return error when branch deletion fails', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'error: branch not fully merged', 1)
      );

      const result = await service.deleteLocal('feature/unmerged');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should refuse to delete main branch', async () => {
      const result = await service.deleteLocal('main');

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
      // Should not call git at all
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should refuse to delete master branch', async () => {
      const result = await service.deleteLocal('master');

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should refuse to delete develop branch', async () => {
      const result = await service.deleteLocal('develop');

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('deleteRemote', () => {
    it('should delete remote branch successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.deleteRemote('feature/test');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call git push with --delete flag', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.deleteRemote('feature/my-feature');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['push', 'origin', '--delete', 'feature/my-feature'],
        expect.any(Object)
      );
    });

    it('should return error when remote deletion fails', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'error: unable to delete remote ref', 1)
      );

      const result = await service.deleteRemote('feature/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should refuse to delete main branch remotely', async () => {
      const result = await service.deleteRemote('main');

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should refuse to delete master branch remotely', async () => {
      const result = await service.deleteRemote('master');

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when branch exists', async () => {
      mockSpawn.mockReturnValue(createMockProcess('refs/heads/feature/test', '', 0));

      const result = await service.exists('feature/test');

      expect(result).toBe(true);
    });

    it('should return false when branch does not exist', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 1));

      const result = await service.exists('nonexistent');

      expect(result).toBe(false);
    });

    it('should call git rev-parse with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.exists('feature/test');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--verify', 'refs/heads/feature/test'],
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle git not installed error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (err?: Error | number) => void) => {
          if (event === 'error') {
            callback(new Error('spawn git ENOENT'));
          }
        })
      };
      mockSpawn.mockReturnValue(mockProcess);

      const result = await service.deleteLocal('feature/test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('git');
    });
  });
});
