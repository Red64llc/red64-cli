/**
 * Commit Service
 * Task 3.1: Create commit service with stage and commit capabilities
 * Requirements: 1.6, 5.3, 5.7
 */

import { spawn } from 'node:child_process';

/**
 * Commit result interface
 * Requirements: 5.3 - Return commit hash on success
 */
export interface CommitResult {
  readonly success: boolean;
  readonly commitHash: string | undefined;
  readonly error: string | undefined;
}

/**
 * Commit service interface
 * Requirements: 1.6, 5.3, 5.7
 */
export interface CommitServiceInterface {
  stageAll(workingDir: string): Promise<CommitResult>;
  commit(workingDir: string, message: string): Promise<CommitResult>;
  stageAndCommit(workingDir: string, message: string): Promise<CommitResult>;
  formatTaskCommitMessage(feature: string, taskIndex: number, taskTitle: string): string;
  formatPhaseCommitMessage(feature: string, phase: string): string;
  /**
   * Count commits on current branch since branching from base
   * Returns 0 if unable to determine
   */
  countFeatureCommits(workingDir: string, baseBranch?: string): Promise<number>;
}

/**
 * Execute git command and return result
 */
function execGit(
  args: readonly string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const process = spawn('git', args as string[], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    process.on('error', (error) => {
      resolve({
        stdout,
        stderr: stderr || `Git error: ${error.message}`,
        exitCode: -1
      });
    });
  });
}

/**
 * Extract commit hash from git commit output
 * Format: [branch hash] message
 */
function extractCommitHash(output: string): string | undefined {
  // Match pattern like [main abc1234] or [feature/test deadbeef]
  const match = output.match(/\[[\w\/-]+\s+([a-f0-9]+)\]/);
  return match?.[1];
}

/**
 * Check if output indicates no changes to commit
 */
function isNothingToCommit(stderr: string): boolean {
  return stderr.includes('nothing to commit') || stderr.includes('working tree clean');
}

/**
 * Create commit service
 * Requirements: 1.6, 5.3, 5.7 - Factory function for git commit operations
 */
export function createCommitService(): CommitServiceInterface {
  return {
    /**
     * Stage all changes in working directory
     * Requirements: 5.3 - Stage all changes using git add
     */
    async stageAll(workingDir: string): Promise<CommitResult> {
      const result = await execGit(['add', '-A'], workingDir);

      if (result.exitCode !== 0) {
        return {
          success: false,
          commitHash: undefined,
          error: result.stderr || 'Failed to stage changes'
        };
      }

      return {
        success: true,
        commitHash: undefined,
        error: undefined
      };
    },

    /**
     * Create commit with provided message
     * Requirements: 5.3 - Create commit using git commit
     * Requirements: 5.7 - Handle empty commits gracefully
     */
    async commit(workingDir: string, message: string): Promise<CommitResult> {
      const result = await execGit(['commit', '-m', message], workingDir);

      // Handle "nothing to commit" as success (no-op)
      if (result.exitCode !== 0 && isNothingToCommit(result.stderr)) {
        return {
          success: true,
          commitHash: undefined,
          error: undefined
        };
      }

      if (result.exitCode !== 0) {
        return {
          success: false,
          commitHash: undefined,
          error: result.stderr || 'Failed to commit changes'
        };
      }

      const commitHash = extractCommitHash(result.stdout);

      return {
        success: true,
        commitHash,
        error: undefined
      };
    },

    /**
     * Stage and commit in single atomic operation
     * Requirements: 5.3 - Combine stage and commit
     */
    async stageAndCommit(workingDir: string, message: string): Promise<CommitResult> {
      // Stage all changes
      const stageResult = await this.stageAll(workingDir);
      if (!stageResult.success) {
        return stageResult;
      }

      // Commit changes
      return this.commit(workingDir, message);
    },

    /**
     * Format commit message for task completion
     * Requirements: 5.7 - Generate meaningful commit messages
     */
    formatTaskCommitMessage(_feature: string, _taskIndex: number, taskTitle: string): string {
      return taskTitle;
    },

    /**
     * Format commit message for phase completion
     * Requirements: 1.6 - Commit changes at each phase
     */
    formatPhaseCommitMessage(_feature: string, phase: string): string {
      return phase;
    },

    /**
     * Count commits on current branch since branching from base
     * Uses git rev-list to count commits not in base branch
     */
    async countFeatureCommits(workingDir: string, baseBranch?: string): Promise<number> {
      // Try to determine base branch if not specified
      const base = baseBranch ?? 'main';

      // First check if base branch exists
      const checkResult = await execGit(['rev-parse', '--verify', base], workingDir);
      if (checkResult.exitCode !== 0) {
        // Try 'master' as fallback
        const masterCheck = await execGit(['rev-parse', '--verify', 'master'], workingDir);
        if (masterCheck.exitCode !== 0) {
          // Can't determine base, return total commits on current branch
          const totalResult = await execGit(['rev-list', '--count', 'HEAD'], workingDir);
          return totalResult.exitCode === 0 ? parseInt(totalResult.stdout.trim(), 10) || 0 : 0;
        }
        // Use master as base
        const result = await execGit(['rev-list', '--count', 'HEAD', '^master'], workingDir);
        return result.exitCode === 0 ? parseInt(result.stdout.trim(), 10) || 0 : 0;
      }

      // Count commits not in base branch
      const result = await execGit(['rev-list', '--count', 'HEAD', `^${base}`], workingDir);
      return result.exitCode === 0 ? parseInt(result.stdout.trim(), 10) || 0 : 0;
    }
  };
}
