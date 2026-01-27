/**
 * Agent Invoker service for Claude CLI execution
 * Requirements: 7.1-7.7, 2.1-2.6
 * Supports both direct execution and Docker sandbox mode
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentInvokeOptions, AgentResult } from '../types/index.js';
import { createClaudeErrorDetector } from './ClaudeErrorDetector.js';

const SANDBOX_IMAGE = 'red64-sandbox:latest';

/**
 * Try to read API key from Claude config directory
 * Claude stores credentials in various files within the config dir
 */
function readApiKeyFromConfig(configDir: string): string | null {
  // Try common credential file locations
  const credentialPaths = [
    join(configDir, 'credentials.json'),
    join(configDir, '.credentials.json'),
    join(configDir, 'settings.json'),
    join(configDir, 'config.json'),
  ];

  for (const credPath of credentialPaths) {
    if (existsSync(credPath)) {
      try {
        const content = readFileSync(credPath, 'utf-8');
        const data = JSON.parse(content);
        // Check various possible key names
        const apiKey = data.apiKey || data.api_key || data.ANTHROPIC_API_KEY || data.anthropicApiKey;
        if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-')) {
          return apiKey;
        }
      } catch {
        // Continue to next file
      }
    }
  }

  return null;
}

/**
 * Get API key from environment or Claude config
 */
function getApiKey(tier?: string): string | null {
  // First check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (!homeDir) return null;

  // Try tier-specific config first
  if (tier) {
    const tierConfig = join(homeDir, `.claude-${tier}`);
    const key = readApiKeyFromConfig(tierConfig);
    if (key) return key;
  }

  // Try default Claude config
  const defaultConfig = join(homeDir, '.claude');
  return readApiKeyFromConfig(defaultConfig);
}

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
  const errorDetector = createClaudeErrorDetector();

  return {
    /**
     * Invoke Claude CLI with options
     * Requirements: 7.2 - Spawn Claude CLI as child process
     * Requirements: 7.3, 7.4 - Pass skip-permissions and tier configuration
     */
    async invoke(options: AgentInvokeOptions): Promise<AgentResult> {
      aborted = false;

      // Use Docker sandbox if enabled
      if (options.sandbox) {
        return invokeInDocker(options, () => currentProcess, (p) => { currentProcess = p; }, () => aborted, errorDetector);
      }

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
        // Format: --tier=red64 -> CLAUDE_CONFIG_DIR=~/.claude-red64
        if (options.tier) {
          const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '~';
          env.CLAUDE_CONFIG_DIR = `${homeDir}/.claude-${options.tier}`;
        }

        // Spawn Claude CLI
        // Requirements: 7.2 - Use spawn() for streaming output
        currentProcess = spawn('claude', args, {
          cwd: options.workingDirectory,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Close stdin immediately - Claude CLI doesn't need input
        currentProcess.stdin?.end();

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Handle timeout (default 10 minutes for long-running tasks)
        const timeoutMs = options.timeout ?? 600000;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          if (currentProcess) {
            currentProcess.kill('SIGTERM');
          }
        }, timeoutMs);

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
          clearTimeout(timeoutId);

          const exitCode = code ?? -1;
          const success = exitCode === 0 && !timedOut && !aborted;

          // Detect Claude-specific errors
          const claudeError = !success ? errorDetector.detect(stdout, stderr) : undefined;

          // Requirements: 7.6 - Return typed result indicating success/failure
          resolve({
            success,
            exitCode,
            stdout,
            stderr,
            timedOut,
            claudeError: claudeError ?? undefined
          });

          currentProcess = null;
        });

        // Handle spawn errors
        currentProcess.on('error', (error) => {
          clearTimeout(timeoutId);

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

/**
 * Invoke Claude CLI inside Docker sandbox
 * Provides isolation for running with --dangerously-skip-permissions
 */
function invokeInDocker(
  options: AgentInvokeOptions,
  getProcess: () => ChildProcess | null,
  setProcess: (p: ChildProcess | null) => void,
  isAborted: () => boolean,
  errorDetector: ReturnType<typeof createClaudeErrorDetector>
): Promise<AgentResult> {
  return new Promise((resolve) => {
    // Build docker run command
    const dockerArgs: string[] = [
      'run',
      '--rm',                                          // Remove container after exit
      '-w', '/workspace',                              // Working directory inside container
      '-v', `${options.workingDirectory}:/workspace`,  // Mount workspace
    ];

    // Get API key from env or Claude config files
    const apiKey = getApiKey(options.tier);
    if (apiKey) {
      dockerArgs.push('-e', `ANTHROPIC_API_KEY=${apiKey}`);
    }

    // Don't mount the Claude config - let Claude create a fresh one inside container
    // The API key is passed via env var, which is all that's needed

    // Add image
    dockerArgs.push(SANDBOX_IMAGE);

    // Add claude command with args
    // In sandbox, always use --dangerously-skip-permissions since it's isolated
    dockerArgs.push('claude', '-p', options.prompt, '--dangerously-skip-permissions');

    const proc = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    setProcess(proc);

    // Close stdin immediately
    proc.stdin?.end();

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Handle timeout (default 10 minutes)
    const timeoutMs = options.timeout ?? 600000;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      const p = getProcess();
      if (p) {
        p.kill('SIGTERM');
      }
    }, timeoutMs);

    // Capture stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      if (options.onOutput) {
        options.onOutput(chunk);
      }
    });

    // Capture stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      if (options.onError) {
        options.onError(chunk);
      }
    });

    // Handle process close
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const exitCode = code ?? -1;
      const success = exitCode === 0 && !timedOut && !isAborted();

      // Detect Claude-specific errors
      const claudeError = !success ? errorDetector.detect(stdout, stderr) : undefined;

      resolve({
        success,
        exitCode,
        stdout,
        stderr,
        timedOut,
        claudeError: claudeError ?? undefined
      });

      setProcess(null);
    });

    // Handle spawn errors
    proc.on('error', (error) => {
      clearTimeout(timeoutId);

      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr || `Docker error: ${error.message}`,
        timedOut: false
      });

      setProcess(null);
    });
  });
}
