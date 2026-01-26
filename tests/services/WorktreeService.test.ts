/**
 * Worktree Service Tests
 * Task 1.2: Build worktree service for git worktree operations
 * Requirements: 1.3, 1.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createWorktreeService,
  type WorktreeServiceInterface,
  type WorktreeInfo,
  type WorktreeResult
} from '../../src/services/WorktreeService.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;

describe('WorktreeService', () => {
  let service: WorktreeServiceInterface;

  beforeEach(() => {
    service = createWorktreeService();
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

  describe('check', () => {
    it('should return exists: true when worktree exists', async () => {
      const porcelainOutput = `worktree /repo/worktrees/my-feature
HEAD abc123
branch refs/heads/feature/my-feature

worktree /repo
HEAD def456
branch refs/heads/main
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo', 'my-feature');

      expect(result.exists).toBe(true);
      expect(result.path).toBe('/repo/worktrees/my-feature');
      expect(result.branch).toBe('feature/my-feature');
    });

    it('should return exists: false when worktree does not exist', async () => {
      const porcelainOutput = `worktree /repo
HEAD def456
branch refs/heads/main
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo', 'nonexistent');

      expect(result.exists).toBe(false);
    });

    it('should call git with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.check('/repo', 'test-feature');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'list', '--porcelain'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });
  });

  describe('create', () => {
    it('should create worktree successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('Preparing worktree', '', 0));

      const result = await service.create('/repo', 'new-feature');

      expect(result.success).toBe(true);
      expect(result.path).toContain('worktrees/new-feature');
      expect(result.error).toBeUndefined();
    });

    it('should call git with correct arguments for worktree creation', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.create('/repo', 'my-feature');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '-b', 'feature/my-feature', 'worktrees/my-feature'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should return error when git fails', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'fatal: branch already exists', 1));

      const result = await service.create('/repo', 'existing');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should remove worktree successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.remove('/repo', 'old-feature');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call git with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.remove('/repo', 'feature-to-remove');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', 'worktrees/feature-to-remove'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should use force flag when specified', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.remove('/repo', 'dirty-feature', true);

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '--force', 'worktrees/dirty-feature'],
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('should return error when removal fails', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', 'error: worktree has modifications', 1));

      const result = await service.remove('/repo', 'dirty');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('list', () => {
    it('should parse and return all worktrees', async () => {
      const porcelainOutput = `worktree /repo/worktrees/feature-a
HEAD abc123
branch refs/heads/feature/feature-a

worktree /repo/worktrees/feature-b
HEAD def456
branch refs/heads/feature/feature-b

worktree /repo
HEAD 789xyz
branch refs/heads/main
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.list('/repo');

      expect(result).toHaveLength(3);
      expect(result[0].path).toBe('/repo/worktrees/feature-a');
      expect(result[0].branch).toBe('feature/feature-a');
      expect(result[1].path).toBe('/repo/worktrees/feature-b');
      expect(result[2].path).toBe('/repo');
      expect(result[2].branch).toBe('main');
    });

    it('should return empty array when no worktrees', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.list('/repo');

      expect(result).toEqual([]);
    });

    it('should handle detached HEAD', async () => {
      const porcelainOutput = `worktree /repo
HEAD abc123
detached
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.list('/repo');

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('');
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

      const result = await service.create('/repo', 'feature');

      expect(result.success).toBe(false);
      expect(result.error).toContain('git');
    });
  });
});
