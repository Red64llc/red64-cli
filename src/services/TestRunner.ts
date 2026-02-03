/**
 * Test Runner Service
 * Executes project tests and reports results
 */

import { spawn } from 'node:child_process';

/**
 * Test execution result
 */
export interface TestResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

/**
 * Test runner options
 */
export interface TestRunnerOptions {
  readonly setupCommand?: string | null;
  readonly testCommand: string;
  readonly workingDir: string;
  readonly timeoutMs?: number;
  readonly onOutput?: (chunk: string) => void;
  readonly onError?: (chunk: string) => void;
}

/**
 * Test runner service interface
 */
export interface TestRunnerService {
  /**
   * Run the test command
   */
  run(options: TestRunnerOptions): Promise<TestResult>;

  /**
   * Parse test command into command and args
   */
  parseCommand(testCommand: string): { cmd: string; args: readonly string[] };
}

/**
 * Default timeout: 5 minutes
 */
const DEFAULT_TIMEOUT_MS = 300000;

/**
 * Create test runner service
 */
export function createTestRunner(): TestRunnerService {
  return {
    parseCommand(testCommand: string): { cmd: string; args: readonly string[] } {
      const parts = testCommand.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      return { cmd, args };
    },

    async run(options: TestRunnerOptions): Promise<TestResult> {
      const startTime = Date.now();
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      // Combine setup and test commands if setup is provided
      const fullCommand = options.setupCommand
        ? `${options.setupCommand} && ${options.testCommand}`
        : options.testCommand;

      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Use shell to handle complex commands (pipes, &&, etc.)
        const proc = spawn(fullCommand, [], {
          cwd: options.workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
          // Force kill after 5 seconds if SIGTERM doesn't work
          setTimeout(() => {
            proc.kill('SIGKILL');
          }, 5000);
        }, timeoutMs);

        // Capture stdout
        proc.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          options.onOutput?.(chunk);
        });

        // Capture stderr
        proc.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          options.onError?.(chunk);
        });

        // Handle completion
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          const durationMs = Date.now() - startTime;

          resolve({
            success: code === 0,
            exitCode: code ?? -1,
            stdout,
            stderr,
            durationMs,
            timedOut
          });
        });

        // Handle spawn errors (e.g., command not found)
        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          const durationMs = Date.now() - startTime;

          resolve({
            success: false,
            exitCode: -1,
            stdout,
            stderr: stderr || error.message,
            durationMs,
            timedOut: false
          });
        });
      });
    }
  };
}
