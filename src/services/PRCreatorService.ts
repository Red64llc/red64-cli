/**
 * PR Creator Service
 * Task 5.1: Build PR creator service for GitHub CLI operations
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CommitResult } from './CommitService.js';

/**
 * PR create options
 * Requirements: 6.2, 6.3 - PR creation configuration
 */
export interface PRCreateOptions {
  readonly workingDir: string;
  readonly feature: string;
  readonly specDir: string;
  readonly baseBranch: string;
}

/**
 * PR create result
 * Requirements: 6.3, 6.4 - PR URL and number
 */
export interface PRCreateResult {
  readonly success: boolean;
  readonly prUrl: string | undefined;
  readonly prNumber: number | undefined;
  readonly error: string | undefined;
}

/**
 * PR merge options
 * Requirements: 6.5, 6.6 - Merge configuration
 */
export interface PRMergeOptions {
  readonly workingDir: string;
  readonly prNumber: number;
  readonly squash: boolean;
  readonly deleteBranch: boolean;
}

/**
 * PR merge result
 */
export interface PRMergeResult {
  readonly success: boolean;
  readonly error: string | undefined;
}

/**
 * PR creator service interface
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export interface PRCreatorServiceInterface {
  push(workingDir: string, remote?: string): Promise<CommitResult>;
  createPR(options: PRCreateOptions): Promise<PRCreateResult>;
  mergePR(options: PRMergeOptions): Promise<PRMergeResult>;
  generatePRBody(specDir: string, feature: string): Promise<string>;
}

/**
 * Execute command and return result
 */
function execCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  stdin?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const process = spawn(command, args as string[], {
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
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
    });

    process.on('error', (error) => {
      resolve({
        stdout,
        stderr: stderr || `Command error: ${error.message}`,
        exitCode: -1
      });
    });

    // Write to stdin if provided
    if (stdin && process.stdin) {
      process.stdin.write(stdin);
      process.stdin.end();
    }
  });
}

/**
 * Extract PR number from URL
 */
function extractPRNumber(url: string): number | undefined {
  const match = url.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Read file safely, returning empty string on error
 */
async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Extract summary from requirements.md
 */
function extractRequirementsSummary(content: string): string {
  if (!content) return 'No requirements available';

  // Try to extract first paragraph after the title
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 3).join(' ').trim() || 'Requirements defined in spec';
}

/**
 * Extract overview from design.md
 */
function extractDesignOverview(content: string): string {
  if (!content) return 'No design available';

  // Try to extract overview section
  const overviewMatch = content.match(/##\s*Overview\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (overviewMatch) {
    return overviewMatch[1].trim().split('\n').slice(0, 3).join(' ').trim();
  }

  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 3).join(' ').trim() || 'Design defined in spec';
}

/**
 * Extract task summary from tasks.md
 */
function extractTasksSummary(content: string): string {
  if (!content) return 'No tasks available';

  // Count completed and total tasks
  const taskLines = content.match(/- \[([ x])\]/g) || [];
  const completed = taskLines.filter(l => l.includes('[x]')).length;
  const total = taskLines.length;

  return `${completed}/${total} tasks completed`;
}

/**
 * Create PR creator service
 * Requirements: 6.1, 6.2, 6.3, 6.4 - Factory function for PR operations
 */
export function createPRCreatorService(): PRCreatorServiceInterface {
  return {
    /**
     * Push branch to remote
     * Requirements: 6.1 - Push feature branch using git
     */
    async push(workingDir: string, remote: string = 'origin'): Promise<CommitResult> {
      const result = await execCommand(
        'git',
        ['push', '-u', remote, 'HEAD'],
        workingDir
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          commitHash: undefined,
          error: result.stderr || 'Failed to push branch'
        };
      }

      return {
        success: true,
        commitHash: undefined,
        error: undefined
      };
    },

    /**
     * Create pull request using GitHub CLI
     * Requirements: 6.2, 6.3, 6.4 - Create PR with spec artifacts
     */
    async createPR(options: PRCreateOptions): Promise<PRCreateResult> {
      // Generate PR body from spec artifacts
      const body = await this.generatePRBody(options.specDir, options.feature);

      // Build title
      const title = `feat: ${options.feature}`;

      // Create PR using gh CLI
      const result = await execCommand(
        'gh',
        ['pr', 'create', '--title', title, '--body', body, '--base', options.baseBranch],
        options.workingDir
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          prUrl: undefined,
          prNumber: undefined,
          error: result.stderr || 'Failed to create PR'
        };
      }

      const prUrl = result.stdout;
      const prNumber = extractPRNumber(prUrl);

      return {
        success: true,
        prUrl,
        prNumber,
        error: undefined
      };
    },

    /**
     * Merge pull request
     * Requirements: 6.5, 6.6 - Squash merge and delete branch
     */
    async mergePR(options: PRMergeOptions): Promise<PRMergeResult> {
      const args = ['pr', 'merge', options.prNumber.toString()];

      if (options.squash) {
        args.push('--squash');
      }

      if (options.deleteBranch) {
        args.push('--delete-branch');
      }

      const result = await execCommand('gh', args, options.workingDir);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to merge PR'
        };
      }

      return {
        success: true,
        error: undefined
      };
    },

    /**
     * Generate PR body from spec artifacts
     * Requirements: 6.2 - Read spec artifacts for PR body
     * Requirements: 6.4 - Include links to spec artifacts
     */
    async generatePRBody(specDir: string, feature: string): Promise<string> {
      // Read spec artifacts
      const requirementsPath = join(specDir, 'requirements.md');
      const designPath = join(specDir, 'design.md');
      const tasksPath = join(specDir, 'tasks.md');

      const [requirements, design, tasks] = await Promise.all([
        readFileSafe(requirementsPath),
        readFileSafe(designPath),
        readFileSafe(tasksPath)
      ]);

      const requirementsSummary = extractRequirementsSummary(requirements);
      const designOverview = extractDesignOverview(design);
      const tasksSummary = extractTasksSummary(tasks);

      return `## Feature: ${feature}

### Summary
${requirementsSummary}

### Design
${designOverview}

### Tasks
${tasksSummary}

---
**Spec Artifacts**
- [Requirements](.red64/specs/${feature}/requirements.md)
- [Design](.red64/specs/${feature}/design.md)
- [Tasks](.red64/specs/${feature}/tasks.md)
`;
    }
  };
}
