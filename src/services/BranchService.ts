/**
 * Branch Service
 * Task 1.3: Implement branch management service
 * Requirements: 4.2
 */

import { spawn } from 'node:child_process';

/**
 * Result of branch deletion operation
 * Requirements: 4.2 - Report success/failure for branch operations
 */
export interface BranchDeleteResult {
  readonly success: boolean;
  readonly error: string | undefined;
}

/**
 * Branch service interface
 * Requirements: 4.2 - Delete feature branches on abort
 */
export interface BranchServiceInterface {
  deleteLocal(branchName: string, force?: boolean): Promise<BranchDeleteResult>;
  deleteRemote(branchName: string): Promise<BranchDeleteResult>;
  exists(branchName: string): Promise<boolean>;
}

/**
 * Protected branch names that should never be deleted
 */
const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'development', 'release']);

/**
 * Check if a branch name is protected
 */
function isProtectedBranch(branchName: string): boolean {
  return PROTECTED_BRANCHES.has(branchName.toLowerCase());
}

/**
 * Execute git command and return result
 */
function execGit(
  args: readonly string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const process = spawn('git', args as string[], {
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
        stderr: stderr || `git error: ${error.message}`,
        exitCode: -1
      });
    });
  });
}

/**
 * Create branch service
 * Requirements: 4.2 - Factory function for branch operations
 */
export function createBranchService(): BranchServiceInterface {
  return {
    /**
     * Delete a local branch
     * Requirements: 4.2 - Delete local branch with optional force flag
     */
    async deleteLocal(branchName: string, force?: boolean): Promise<BranchDeleteResult> {
      // Never delete protected branches
      if (isProtectedBranch(branchName)) {
        return {
          success: false,
          error: `Cannot delete protected branch: ${branchName}`
        };
      }

      const flag = force ? '-D' : '-d';
      const result = await execGit(['branch', flag, branchName]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to delete branch'
        };
      }

      return {
        success: true,
        error: undefined
      };
    },

    /**
     * Delete a remote branch
     * Requirements: 4.2 - Delete remote branch via git push
     */
    async deleteRemote(branchName: string): Promise<BranchDeleteResult> {
      // Never delete protected branches
      if (isProtectedBranch(branchName)) {
        return {
          success: false,
          error: `Cannot delete protected branch: ${branchName}`
        };
      }

      const result = await execGit(['push', 'origin', '--delete', branchName]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to delete remote branch'
        };
      }

      return {
        success: true,
        error: undefined
      };
    },

    /**
     * Check if a branch exists
     * Requirements: 4.2 - Branch existence check before operations
     */
    async exists(branchName: string): Promise<boolean> {
      const result = await execGit([
        'rev-parse',
        '--verify',
        `refs/heads/${branchName}`
      ]);

      return result.exitCode === 0;
    }
  };
}
