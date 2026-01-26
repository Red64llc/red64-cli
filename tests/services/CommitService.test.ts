/**
 * Commit Service Tests
 * Task 3.1: Create commit service with stage and commit capabilities
 * Requirements: 1.6, 5.3, 5.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createCommitService,
  type CommitServiceInterface,
  type CommitResult
} from '../../src/services/CommitService.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;

describe('CommitService', () => {
  let service: CommitServiceInterface;

  beforeEach(() => {
    service = createCommitService();
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

  describe('stageAll', () => {
    it('should stage all changes successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.stageAll('/repo');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call git with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.stageAll('/repo');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['add', '-A'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should return error when staging fails', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'fatal: not a git repository', 128));

      const result = await service.stageAll('/repo');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('commit', () => {
    it('should commit changes successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('[main abc1234] Test commit\n 1 file changed', '', 0));

      const result = await service.commit('/repo', 'Test commit');

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc1234');
      expect(result.error).toBeUndefined();
    });

    it('should call git with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('[main abc1234] Test', '', 0));

      await service.commit('/repo', 'Test commit message');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'Test commit message'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should handle empty working directory gracefully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'nothing to commit, working tree clean', 1));

      const result = await service.commit('/repo', 'Test');

      // No changes should be success (no-op)
      expect(result.success).toBe(true);
      expect(result.commitHash).toBeUndefined();
    });

    it('should return error for actual commit failures', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'error: unable to create lock file', 128));

      const result = await service.commit('/repo', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract commit hash from output', async () => {
      mockSpawn.mockReturnValue(createMockProcess('[feature/test deadbeef] feat: something', '', 0));

      const result = await service.commit('/repo', 'Test');

      expect(result.commitHash).toBe('deadbeef');
    });
  });

  describe('stageAndCommit', () => {
    it('should stage and commit in one operation', async () => {
      // First call: git add -A
      // Second call: git commit -m
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockProcess('', '', 0);
        }
        return createMockProcess('[main abc1234] Test', '', 0);
      });

      const result = await service.stageAndCommit('/repo', 'Test commit');

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc1234');
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('should return error if staging fails', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'fatal: error', 128));

      const result = await service.stageAndCommit('/repo', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle no changes gracefully', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockProcess('', '', 0);
        }
        return createMockProcess('', 'nothing to commit, working tree clean', 1);
      });

      const result = await service.stageAndCommit('/repo', 'Test');

      expect(result.success).toBe(true);
    });
  });

  describe('formatCommitMessage', () => {
    it('should format task commit message correctly', async () => {
      mockSpawn.mockReturnValue(createMockProcess('[main abc1234] Test', '', 0));

      const message = service.formatTaskCommitMessage('my-feature', 1, 'Setup project structure');

      expect(message).toBe('feat(my-feature): implement task 1 - Setup project structure');
    });

    it('should format phase commit message correctly', async () => {
      const message = service.formatPhaseCommitMessage('my-feature', 'requirements');

      expect(message).toBe('feat(my-feature): complete requirements phase');
    });
  });

  describe('error handling', () => {
    it('should handle git not found error', async () => {
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

      const result = await service.commit('/repo', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('git');
    });
  });
});
