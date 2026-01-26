/**
 * PRStatusFetcher Service Tests
 * Task 1.2: Implement PR status fetching service
 * Requirements: 2.4, 4.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createPRStatusFetcher,
  type PRStatusFetcherService,
  type PRStatus,
  type PRCloseResult
} from '../../src/services/PRStatusFetcher.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = spawn as ReturnType<typeof vi.fn>;

describe('PRStatusFetcher', () => {
  let service: PRStatusFetcherService;

  beforeEach(() => {
    service = createPRStatusFetcher();
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

  describe('getStatus', () => {
    it('should fetch PR status by number', async () => {
      const prJson = JSON.stringify({
        number: 123,
        url: 'https://github.com/owner/repo/pull/123',
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        reviewDecision: 'APPROVED',
        statusCheckRollup: {
          state: 'SUCCESS'
        }
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus(123);

      expect(result).toBeDefined();
      expect(result?.number).toBe(123);
      expect(result?.state).toBe('open');
      expect(result?.mergeable).toBe(true);
      expect(result?.reviewDecision).toBe('approved');
      expect(result?.checksStatus).toBe('passing');
    });

    it('should fetch PR status by URL', async () => {
      const prJson = JSON.stringify({
        number: 456,
        url: 'https://github.com/owner/repo/pull/456',
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        reviewDecision: 'REVIEW_REQUIRED',
        statusCheckRollup: null
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus('https://github.com/owner/repo/pull/456');

      expect(result).toBeDefined();
      expect(result?.number).toBe(456);
      expect(result?.reviewDecision).toBe('review_required');
      expect(result?.checksStatus).toBe('unknown');
    });

    it('should call gh with correct arguments for PR number', async () => {
      mockSpawn.mockReturnValue(createMockProcess('{}', '', 0));

      await service.getStatus(123);

      expect(mockSpawn).toHaveBeenCalledWith(
        'gh',
        ['pr', 'view', '123', '--json', 'number,url,state,mergeable,reviewDecision,statusCheckRollup'],
        expect.any(Object)
      );
    });

    it('should call gh with correct arguments for PR URL', async () => {
      mockSpawn.mockReturnValue(createMockProcess('{}', '', 0));

      await service.getStatus('https://github.com/owner/repo/pull/789');

      expect(mockSpawn).toHaveBeenCalledWith(
        'gh',
        ['pr', 'view', 'https://github.com/owner/repo/pull/789', '--json', 'number,url,state,mergeable,reviewDecision,statusCheckRollup'],
        expect.any(Object)
      );
    });

    it('should handle closed PR', async () => {
      const prJson = JSON.stringify({
        number: 100,
        url: 'https://github.com/owner/repo/pull/100',
        state: 'CLOSED',
        mergeable: 'UNKNOWN',
        reviewDecision: null,
        statusCheckRollup: null
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus(100);

      expect(result?.state).toBe('closed');
    });

    it('should handle merged PR', async () => {
      const prJson = JSON.stringify({
        number: 200,
        url: 'https://github.com/owner/repo/pull/200',
        state: 'MERGED',
        mergeable: 'UNKNOWN',
        reviewDecision: 'APPROVED',
        statusCheckRollup: { state: 'SUCCESS' }
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus(200);

      expect(result?.state).toBe('merged');
    });

    it('should handle failing checks', async () => {
      const prJson = JSON.stringify({
        number: 300,
        url: 'https://github.com/owner/repo/pull/300',
        state: 'OPEN',
        mergeable: 'CONFLICTING',
        reviewDecision: 'CHANGES_REQUESTED',
        statusCheckRollup: { state: 'FAILURE' }
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus(300);

      expect(result?.mergeable).toBe(false);
      expect(result?.reviewDecision).toBe('changes_requested');
      expect(result?.checksStatus).toBe('failing');
    });

    it('should handle pending checks', async () => {
      const prJson = JSON.stringify({
        number: 400,
        url: 'https://github.com/owner/repo/pull/400',
        state: 'OPEN',
        mergeable: 'UNKNOWN',
        reviewDecision: null,
        statusCheckRollup: { state: 'PENDING' }
      });
      mockSpawn.mockReturnValue(createMockProcess(prJson, '', 0));

      const result = await service.getStatus(400);

      expect(result?.checksStatus).toBe('pending');
    });

    it('should return undefined when PR not found', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'Could not resolve to a PullRequest', 1)
      );

      const result = await service.getStatus(999);

      expect(result).toBeUndefined();
    });

    it('should return undefined when not authenticated', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'gh: not logged in', 1)
      );

      const result = await service.getStatus(123);

      expect(result).toBeUndefined();
    });
  });

  describe('close', () => {
    it('should close PR successfully', async () => {
      mockSpawn.mockReturnValue(createMockProcess('Closed pull request #123', '', 0));

      const result = await service.close(123);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should call gh with correct arguments', async () => {
      mockSpawn.mockReturnValue(createMockProcess('', '', 0));

      await service.close(456);

      expect(mockSpawn).toHaveBeenCalledWith(
        'gh',
        ['pr', 'close', '456'],
        expect.any(Object)
      );
    });

    it('should return error when close fails', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess('', 'pull request is already closed', 1)
      );

      const result = await service.close(123);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (err?: Error | number) => void) => {
          if (event === 'error') {
            callback(new Error('network error'));
          }
        })
      };
      mockSpawn.mockReturnValue(mockProcess);

      const result = await service.close(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });
  });

  describe('error handling', () => {
    it('should handle gh not installed error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (err?: Error | number) => void) => {
          if (event === 'error') {
            callback(new Error('spawn gh ENOENT'));
          }
        })
      };
      mockSpawn.mockReturnValue(mockProcess);

      const result = await service.getStatus(123);

      expect(result).toBeUndefined();
    });

    it('should handle invalid JSON response', async () => {
      mockSpawn.mockReturnValue(createMockProcess('not valid json', '', 0));

      const result = await service.getStatus(123);

      expect(result).toBeUndefined();
    });
  });
});
