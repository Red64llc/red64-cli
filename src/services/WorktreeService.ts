/**
 * Worktree Service
 * Task 1.2: Build worktree service for git worktree operations
 * Requirements: 1.3, 1.4
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Worktree information
 * Requirements: 1.3 - Check for existing worktree
 */
export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string;
  readonly exists: boolean;
}

/**
 * Worktree operation result
 * Requirements: 1.4 - Create worktree with branch
 */
export interface WorktreeResult {
  readonly success: boolean;
  readonly path: string | undefined;
  readonly error: string | undefined;
}

/**
 * Worktree service interface
 * Requirements: 1.3, 1.4
 */
export interface WorktreeServiceInterface {
  check(repoPath: string, feature: string): Promise<WorktreeInfo>;
  create(repoPath: string, feature: string): Promise<WorktreeResult>;
  remove(repoPath: string, feature: string, force?: boolean): Promise<WorktreeResult>;
  list(repoPath: string): Promise<readonly WorktreeInfo[]>;
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
 * Parse porcelain output from git worktree list
 */
function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = output.trim().split('\n');

  let currentPath = '';
  let currentBranch = '';

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      // If we have a previous worktree, push it
      if (currentPath) {
        worktrees.push({
          path: currentPath,
          branch: currentBranch,
          exists: true
        });
      }
      currentPath = line.substring(9); // Remove 'worktree '
      currentBranch = '';
    } else if (line.startsWith('branch refs/heads/')) {
      currentBranch = line.substring(18); // Remove 'branch refs/heads/'
    } else if (line === 'detached') {
      currentBranch = '';
    }
  }

  // Push last worktree
  if (currentPath) {
    worktrees.push({
      path: currentPath,
      branch: currentBranch,
      exists: true
    });
  }

  return worktrees;
}

/**
 * Sanitize feature name for use in git branch names and paths
 * - Replace spaces with hyphens
 * - Remove invalid characters
 * - Convert to lowercase
 */
export function sanitizeFeatureName(feature: string): string {
  return feature
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9\-_]/g, '')   // Remove invalid characters
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');         // Trim leading/trailing hyphens
}

/**
 * Get worktree path for a feature
 */
function getWorktreePath(repoPath: string, feature: string): string {
  return join(repoPath, 'worktrees', sanitizeFeatureName(feature));
}

/**
 * Get branch name for a feature
 */
function getBranchName(feature: string): string {
  return `feature/${sanitizeFeatureName(feature)}`;
}

/**
 * Create worktree service
 * Requirements: 1.3, 1.4 - Factory function for git worktree operations
 */
export function createWorktreeService(): WorktreeServiceInterface {
  return {
    /**
     * Check if a worktree exists for a given feature
     * Requirements: 1.3 - Check for existing worktree
     */
    async check(repoPath: string, feature: string): Promise<WorktreeInfo> {
      const result = await execGit(['worktree', 'list', '--porcelain'], repoPath);

      if (result.exitCode !== 0) {
        return {
          path: '',
          branch: '',
          exists: false
        };
      }

      const worktrees = parseWorktreeList(result.stdout);
      const expectedPath = getWorktreePath(repoPath, feature);
      const expectedBranch = getBranchName(feature);

      const found = worktrees.find(
        (wt) => wt.path === expectedPath || wt.branch === expectedBranch
      );

      if (found) {
        return {
          path: found.path,
          branch: found.branch,
          exists: true
        };
      }

      return {
        path: '',
        branch: '',
        exists: false
      };
    },

    /**
     * Create a new worktree for a feature
     * Requirements: 1.4 - Create worktree at worktrees/<feature> with branch feature/<feature>
     */
    async create(repoPath: string, feature: string): Promise<WorktreeResult> {
      const sanitized = sanitizeFeatureName(feature);
      const worktreePath = `worktrees/${sanitized}`;
      const branchName = getBranchName(feature);

      const result = await execGit(
        ['worktree', 'add', '-b', branchName, worktreePath],
        repoPath
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          path: undefined,
          error: result.stderr || 'Failed to create worktree'
        };
      }

      return {
        success: true,
        path: getWorktreePath(repoPath, feature),
        error: undefined
      };
    },

    /**
     * Remove a worktree
     * Requirements: 1.4 - Worktree cleanup
     */
    async remove(
      repoPath: string,
      feature: string,
      force?: boolean
    ): Promise<WorktreeResult> {
      const worktreePath = `worktrees/${sanitizeFeatureName(feature)}`;
      const args = force
        ? ['worktree', 'remove', '--force', worktreePath]
        : ['worktree', 'remove', worktreePath];

      const result = await execGit(args, repoPath);

      if (result.exitCode !== 0) {
        return {
          success: false,
          path: undefined,
          error: result.stderr || 'Failed to remove worktree'
        };
      }

      return {
        success: true,
        path: getWorktreePath(repoPath, feature),
        error: undefined
      };
    },

    /**
     * List all worktrees
     * Requirements: 1.3 - Parse git worktree list output
     */
    async list(repoPath: string): Promise<readonly WorktreeInfo[]> {
      const result = await execGit(['worktree', 'list', '--porcelain'], repoPath);

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return [];
      }

      return parseWorktreeList(result.stdout);
    }
  };
}
