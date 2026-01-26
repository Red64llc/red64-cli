/**
 * Git Status Checker Service
 * Task 1.1: Implement git status checking service
 * Requirements: 1.3, 5.1
 */

import { spawn } from 'node:child_process';

/**
 * Git status information
 * Requirements: 1.3 - Detect uncommitted changes
 */
export interface GitStatus {
  readonly hasChanges: boolean;
  readonly staged: number;
  readonly unstaged: number;
  readonly untracked: number;
}

/**
 * Git status checker service interface
 * Requirements: 1.3 - Check for uncommitted changes in worktree
 */
export interface GitStatusCheckerService {
  check(workingDir: string): Promise<GitStatus>;
  hasUncommittedChanges(workingDir: string): Promise<boolean>;
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
 * Parse git status --porcelain output
 *
 * Status format: XY filename
 * X = index status (staged)
 * Y = work tree status (unstaged)
 *
 * Status codes:
 * M = modified, A = added, D = deleted, R = renamed, C = copied
 * U = updated but unmerged, ? = untracked, ! = ignored
 */
function parseGitStatus(output: string): GitStatus {
  // Don't use trim() on the full output - it removes significant leading spaces
  // from status lines like " M filename" (space = no staged, M = modified in worktree)
  if (!output || output.trim() === '') {
    return {
      hasChanges: false,
      staged: 0,
      unstaged: 0,
      untracked: 0
    };
  }

  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  // Split by newline but don't trim - preserve leading spaces
  const lines = output.split('\n');

  for (const line of lines) {
    // Skip empty lines (but keep lines with content)
    if (line.length < 2) continue;

    const x = line[0]; // Index status (staged)
    const y = line[1]; // Work tree status (unstaged)

    // Untracked files
    if (x === '?' && y === '?') {
      untracked++;
      continue;
    }

    // Ignored files - skip
    if (x === '!' && y === '!') {
      continue;
    }

    // Check staged changes (index status)
    if (x !== ' ' && x !== '?') {
      staged++;
    }

    // Check unstaged changes (work tree status)
    if (y !== ' ' && y !== '?') {
      unstaged++;
    }
  }

  return {
    hasChanges: staged > 0 || unstaged > 0 || untracked > 0,
    staged,
    unstaged,
    untracked
  };
}

/**
 * Create git status checker service
 * Requirements: 1.3 - Factory function for git status checking
 */
export function createGitStatusChecker(): GitStatusCheckerService {
  return {
    /**
     * Check git working directory for uncommitted changes
     * Requirements: 1.3 - Detect staged, unstaged, and untracked changes
     */
    async check(workingDir: string): Promise<GitStatus> {
      const result = await execGit(['status', '--porcelain'], workingDir);

      if (result.exitCode !== 0) {
        // Non-zero exit code - not a git repo or error
        return {
          hasChanges: false,
          staged: 0,
          unstaged: 0,
          untracked: 0
        };
      }

      return parseGitStatus(result.stdout);
    },

    /**
     * Check if there are any uncommitted changes
     * Requirements: 1.3 - Simple boolean check for changes
     */
    async hasUncommittedChanges(workingDir: string): Promise<boolean> {
      const status = await this.check(workingDir);
      return status.hasChanges;
    }
  };
}
