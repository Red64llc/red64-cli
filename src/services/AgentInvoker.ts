/**
 * Agent Invoker service for Claude CLI execution
 * Requirements: 7.1-7.7, 2.1-2.6
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { AgentInvokeOptions, AgentResult } from '../types/index.js';

/**
 * Agent invoker service interface
 * Requirements: 7.1 - Wrap Claude CLI execution as typed TypeScript interface
 */
export interface AgentInvokerService {
  invoke(options: AgentInvokeOptions): Promise<AgentResult>;
  abort(): void;
}

/**
 * Create agent invoker service
 * Requirements: 7.1 - Factory function for agent invocation
 */
export function createAgentInvoker(): AgentInvokerService {
  let currentProcess: ChildProcess | null = null;
  let aborted = false;

  return {
    /**
     * Invoke Claude CLI with options
     * Requirements: 7.2 - Spawn Claude CLI as child process
     * Requirements: 7.3, 7.4 - Pass skip-permissions and tier configuration
     */
    async invoke(options: AgentInvokeOptions): Promise<AgentResult> {
      aborted = false;

      return new Promise((resolve) => {
        // Build command arguments
        const args: string[] = ['-p', options.prompt];

        // Add skip-permissions flag if configured
        // Requirements: 7.3 - Pass --skip-permissions flag to Claude CLI when configured
        if (options.skipPermissions) {
          args.push('--dangerously-skip-permissions');
        }

        // Build environment
        const env: NodeJS.ProcessEnv = { ...process.env };

        // Set CLAUDE_CONFIG_DIR if tier is specified
        // Requirements: 7.4 - Set CLAUDE_CONFIG_DIR environment variable when tier is specified
        if (options.tier) {
          env.CLAUDE_CONFIG_DIR = options.tier;
        }

        // Spawn Claude CLI
        // Requirements: 7.2 - Use spawn() for streaming output
        currentProcess = spawn('claude', args, {
          cwd: options.workingDirectory,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Handle timeout
        let timeoutId: NodeJS.Timeout | undefined;
        if (options.timeout) {
          timeoutId = setTimeout(() => {
            timedOut = true;
            if (currentProcess) {
              currentProcess.kill('SIGTERM');
            }
          }, options.timeout);
        }

        // Capture stdout
        // Requirements: 7.5 - Capture stdout/stderr and return them to calling code
        currentProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;

          // Stream output to callback
          // Requirements: 7.7 - Enable UI to display agent output as it streams
          if (options.onOutput) {
            options.onOutput(chunk);
          }
        });

        // Capture stderr
        currentProcess.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;

          // Stream errors to callback
          if (options.onError) {
            options.onError(chunk);
          }
        });

        // Handle process close
        currentProcess.on('close', (code) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          const exitCode = code ?? -1;
          const success = exitCode === 0 && !timedOut && !aborted;

          // Requirements: 7.6 - Return typed result indicating success/failure
          resolve({
            success,
            exitCode,
            stdout,
            stderr,
            timedOut
          });

          currentProcess = null;
        });

        // Handle spawn errors
        currentProcess.on('error', (error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          resolve({
            success: false,
            exitCode: -1,
            stdout,
            stderr: stderr || error.message,
            timedOut: false
          });

          currentProcess = null;
        });
      });
    },

    /**
     * Abort running agent process
     * Requirements: 2.4, 2.6 - Terminate running agent process
     */
    abort(): void {
      aborted = true;
      if (currentProcess) {
        currentProcess.kill('SIGTERM');
      }
    }
  };
}
