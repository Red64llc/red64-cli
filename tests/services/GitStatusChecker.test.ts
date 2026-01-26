/**
 * GitStatusChecker Service Tests
 * Task 1.1: Implement git status checking service
 * Requirements: 1.3, 5.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createGitStatusChecker,
  type GitStatusCheckerService,
  type GitStatus
} from '../../src/services/GitStatusChecker.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;

describe('GitStatusChecker', () => {
  let service: GitStatusCheckerService;

  beforeEach(() => {
    service = createGitStatusChecker();
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
    it('should return no changes when working directory is clean', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(false);
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(0);
    });

    it('should detect staged changes', async () => {
      const porcelainOutput = `M  staged-file.ts
A  new-staged-file.ts
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.staged).toBe(2);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(0);
    });

    it('should detect unstaged changes', async () => {
      const porcelainOutput = ` M unstaged-file.ts
 D deleted-file.ts
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(2);
      expect(result.untracked).toBe(0);
    });

    it('should detect untracked files', async () => {
      const porcelainOutput = `?? new-file-1.ts
?? new-file-2.ts
?? new-dir/
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(3);
    });

    it('should detect mixed changes (staged, unstaged, untracked)', async () => {
      const porcelainOutput = `M  staged.ts
 M unstaged.ts
MM staged-and-unstaged.ts
?? untracked.ts
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.staged).toBe(2); // M_ and MM
      expect(result.unstaged).toBe(2); // _M and MM
      expect(result.untracked).toBe(1);
    });

    it('should call git with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.check('/repo/worktree');

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain'],
        expect.objectContaining({ cwd: '/repo/worktree' })
      );
    });

    it('should handle added, deleted, and renamed files', async () => {
      const porcelainOutput = `A  added.ts
D  deleted.ts
R  old-name.ts -> new-name.ts
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.staged).toBe(3);
    });

    it('should handle copied and updated files', async () => {
      const porcelainOutput = `C  original.ts -> copy.ts
U  conflicted.ts
`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(true);
    });
  });

  describe('hasUncommittedChanges', () => {
    it('should return false when working directory is clean', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      const result = await service.hasUncommittedChanges('/repo');

      expect(result).toBe(false);
    });

    it('should return true when there are changes', async () => {
      const porcelainOutput = ` M modified.ts`;
      mockSpawn.mockReturnValue(createMockProcess(porcelainOutput, '', 0));

      const result = await service.hasUncommittedChanges('/repo');

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle non-git directory', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'fatal: not a git repository', 128)
      );

      const result = await service.check('/not-a-repo');

      // Should return empty status on error
      expect(result.hasChanges).toBe(false);
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(0);
    });

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

      const result = await service.check('/repo');

      expect(result.hasChanges).toBe(false);
    });
  });
});
