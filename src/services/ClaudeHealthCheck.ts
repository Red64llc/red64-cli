/**
 * Claude API Health Check Service
 * Verifies API connectivity and account status before starting flows
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClaudeErrorDetector, type ClaudeError } from './ClaudeErrorDetector.js';
import type { CodingAgent } from '../types/index.js';

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly healthy: boolean;
  readonly error?: ClaudeError;
  readonly message: string;
  readonly durationMs: number;
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  readonly tier?: string;
  readonly sandbox?: boolean;
  readonly timeoutMs?: number;
  readonly agent?: CodingAgent;
}

const SANDBOX_IMAGE = 'red64-sandbox:latest';

/**
 * Read API key from Claude config directory
 */
function readApiKeyFromConfig(configDir: string): string | null {
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
 * Get API key from environment or config
 */
function getApiKey(tier?: string, agent?: CodingAgent): string | null {
  // Check agent-specific env vars first
  if (agent === 'gemini') {
    return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
  }
  if (agent === 'codex') {
    return process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
  }

  // Claude: check env then config files
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (!homeDir) return null;

  if (tier) {
    const tierConfig = join(homeDir, `.claude-${tier}`);
    const key = readApiKeyFromConfig(tierConfig);
    if (key) return key;
  }

  const defaultConfig = join(homeDir, '.claude');
  return readApiKeyFromConfig(defaultConfig);
}

/**
 * Claude Health Check Service Interface
 */
export interface ClaudeHealthCheckService {
  /**
   * Run a quick health check to verify API is ready
   * Sends a minimal prompt to Claude CLI and checks for errors
   */
  check(options?: HealthCheckOptions): Promise<HealthCheckResult>;
}

/**
 * Create Claude health check service
 */
export function createClaudeHealthCheck(): ClaudeHealthCheckService {
  const errorDetector = createClaudeErrorDetector();

  return {
    async check(options?: HealthCheckOptions): Promise<HealthCheckResult> {
      const startTime = Date.now();
      const timeoutMs = options?.timeoutMs ?? 30000; // 30 second timeout for health check

      // Build environment
      const env: NodeJS.ProcessEnv = { ...process.env };
      if (options?.tier) {
        const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '~';
        env.CLAUDE_CONFIG_DIR = `${homeDir}/.claude-${options.tier}`;
      }

      // Minimal prompt that should succeed quickly if API is healthy
      const healthPrompt = 'Reply with exactly: OK';
      const agent = options?.agent ?? 'claude';

      // Build agent-specific health check command
      const getHealthArgs = (): { binary: string; args: string[] } => {
        switch (agent) {
          case 'gemini':
            return { binary: 'gemini', args: [healthPrompt] };
          case 'codex':
            return { binary: 'codex', args: ['exec', healthPrompt] };
          case 'claude':
          default:
            return { binary: 'claude', args: ['-p', healthPrompt] };
        }
      };

      return new Promise((resolve) => {
        let proc: ReturnType<typeof spawn>;
        let stdout = '';
        let stderr = '';

        const { binary, args: healthArgs } = getHealthArgs();

        // Use Docker sandbox if enabled
        if (options?.sandbox) {
          const apiKey = getApiKey(options?.tier, agent);
          const dockerArgs: string[] = [
            'run',
            '--rm',
            '-w', '/workspace',
            '-v', `${process.cwd()}:/workspace`,
          ];

          if (apiKey) {
            const envKey = agent === 'gemini' ? 'GOOGLE_API_KEY'
              : agent === 'codex' ? 'CODEX_API_KEY'
              : 'ANTHROPIC_API_KEY';
            dockerArgs.push('-e', `${envKey}=${apiKey}`);
          }

          dockerArgs.push(SANDBOX_IMAGE);
          dockerArgs.push(binary, ...healthArgs);

          proc = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
        } else {
          proc = spawn(binary, healthArgs, {
            env,
            stdio: ['pipe', 'pipe', 'pipe']
          });
        }

        // Close stdin
        proc.stdin?.end();

        // Set timeout
        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          resolve({
            healthy: false,
            message: 'Health check timed out. Claude API may be slow or unreachable.',
            error: {
              code: 'NETWORK_ERROR',
              message: 'Health check timed out',
              recoverable: true,
              suggestion: 'Check your internet connection and try again'
            },
            durationMs: Date.now() - startTime
          });
        }, timeoutMs);

        // Capture output
        proc.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        // Handle completion
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          const durationMs = Date.now() - startTime;

          // Check for known errors (claude-specific detector)
          const claudeError = agent === 'claude' ? errorDetector.detect(stdout, stderr) : undefined;

          if (claudeError) {
            resolve({
              healthy: false,
              error: claudeError,
              message: errorDetector.formatErrorMessage(claudeError),
              durationMs
            });
            return;
          }

          // Check exit code
          if (code !== 0) {
            // Generic failure - extract first line of stderr or stdout
            const errorLine = (stderr || stdout).trim().split('\n')[0] || 'Unknown error';
            resolve({
              healthy: false,
              error: {
                code: 'UNKNOWN',
                message: errorLine,
                recoverable: false,
                suggestion: `Check ${agent === 'gemini' ? 'Gemini' : agent === 'codex' ? 'Codex' : 'Claude'} CLI configuration and try again`
              },
              message: errorLine,
              durationMs
            });
            return;
          }

          // Success
          resolve({
            healthy: true,
            message: 'API is ready',
            durationMs
          });
        });

        // Handle spawn errors
        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          const durationMs = Date.now() - startTime;

          // Check if Claude CLI is not installed
          if (error.message.includes('ENOENT')) {
            const cliName = agent === 'gemini' ? 'Gemini CLI' : agent === 'codex' ? 'Codex CLI' : 'Claude CLI';
            resolve({
              healthy: false,
              error: {
                code: 'CLI_NOT_FOUND',
                message: `${cliName} not found`,
                recoverable: false,
                suggestion: `Install ${cliName} and ensure it is on your PATH`
              },
              message: `${cliName} is not installed`,
              durationMs
            });
            return;
          }

          resolve({
            healthy: false,
            error: {
              code: 'NETWORK_ERROR',
              message: error.message,
              recoverable: true,
              suggestion: 'Check your system configuration'
            },
            message: error.message,
            durationMs
          });
        });
      });
    }
  };
}
