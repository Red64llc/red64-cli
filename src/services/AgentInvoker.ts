/**
 * Agent Invoker service for Claude CLI execution
 * Requirements: 7.1-7.7, 2.1-2.6
 * Supports both direct execution and Docker sandbox mode
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentInvokeOptions, AgentResult, CodingAgent } from '../types/index.js';
import { createClaudeErrorDetector } from './ClaudeErrorDetector.js';
import { createMcpConfigWriter } from './McpConfigWriter.js';
import { createTokenUsageParser } from './TokenUsageParser.js';

/**
 * Agent CLI configuration per coding agent
 */
interface AgentCliConfig {
  readonly binary: string;
  readonly buildArgs: (options: AgentInvokeOptions) => string[];
  readonly envKeyName?: string;  // API key env var name (e.g., ANTHROPIC_API_KEY)
}

const AGENT_CLI_CONFIGS: Record<CodingAgent, AgentCliConfig> = {
  claude: {
    binary: 'claude',
    envKeyName: 'ANTHROPIC_API_KEY',
    buildArgs(options) {
      const args: string[] = ['-p', options.prompt];
      if (options.model) args.push('--model', options.model);
      if (options.skipPermissions) args.push('--dangerously-skip-permissions');
      return args;
    }
  },
  gemini: {
    binary: 'gemini',
    envKeyName: 'GEMINI_API_KEY',
    buildArgs(options) {
      // -p flag is required for non-interactive (headless) mode
      const args: string[] = ['-p', options.prompt];
      if (options.model) args.push('-m', options.model);
      if (options.skipPermissions) args.push('--approval-mode=yolo');
      return args;
    }
  },
  codex: {
    binary: 'codex',
    envKeyName: 'CODEX_API_KEY',
    buildArgs(options) {
      const args: string[] = ['exec', options.prompt];
      if (options.model) args.push('--model', options.model);
      // codex exec runs in sandbox by default
      return args;
    }
  }
};

function getAgentCliConfig(agent?: CodingAgent): AgentCliConfig {
  return AGENT_CLI_CONFIGS[agent ?? 'claude'];
}

const DEFAULT_SANDBOX_IMAGE = 'ghcr.io/red64llc/red64-sandbox:latest';

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
 * Get API key from environment or agent config
 */
function getApiKey(tier?: string, agent?: CodingAgent): string | null {
  // Check agent-specific env vars first
  if (agent === 'gemini') {
    return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
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
  const mcpConfigWriter = createMcpConfigWriter();
  const tokenUsageParser = createTokenUsageParser();

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
        return invokeInDocker(options, () => currentProcess, (p) => { currentProcess = p; }, () => aborted, errorDetector, mcpConfigWriter, tokenUsageParser);
      }

      // Inject MCP configs before spawning
      const agent = options.agent ?? 'claude';
      if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
        await mcpConfigWriter.inject(agent, options.workingDirectory, options.mcpServers);
      }

      return new Promise((resolve) => {
        const agentConfig = getAgentCliConfig(options.agent);

        // Build command arguments per agent
        const args = agentConfig.buildArgs(options);

        // Build environment
        const env: NodeJS.ProcessEnv = { ...process.env };

        // Set CLAUDE_CONFIG_DIR if tier is specified (claude-specific)
        // Requirements: 7.4 - Set CLAUDE_CONFIG_DIR environment variable when tier is specified
        if (options.tier && (options.agent ?? 'claude') === 'claude') {
          const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '~';
          env.CLAUDE_CONFIG_DIR = `${homeDir}/.claude-${options.tier}`;
        }

        // Set Ollama backend environment variables (claude-specific)
        if (options.ollama && (options.agent ?? 'claude') === 'claude') {
          env.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'http://localhost:11434';
          env.ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN ?? 'ollama';
          // Set dummy API key to bypass Claude CLI validation (Ollama doesn't use it)
          env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'sk-ollama-placeholder';
        }

        // Spawn agent CLI
        // Requirements: 7.2 - Use spawn() for streaming output
        currentProcess = spawn(agentConfig.binary, args, {
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

        // Track if we've already resolved to prevent double-resolution
        let resolved = false;
        const resolveOnce = (result: AgentResult) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            currentProcess = null;

            // Cleanup injected MCP configs
            if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
              mcpConfigWriter.cleanup(agent, options.workingDirectory).catch(() => {});
            }

            resolve(result);
          }
        };

        // Handle process exit (fires when process terminates, before close)
        currentProcess.on('exit', (code, signal) => {
          // If killed by signal or non-zero exit, resolve immediately
          if (signal || (code !== null && code !== 0)) {
            const exitCode = code ?? -1;
            const claudeError = (options.agent ?? 'claude') === 'claude'
              ? errorDetector.detect(stdout, stderr)
              : undefined;
            const tokenUsage = tokenUsageParser.parse(stdout);

            resolveOnce({
              success: false,
              exitCode,
              stdout,
              stderr: stderr || (signal ? `Process killed by signal: ${signal}` : ''),
              timedOut,
              claudeError: claudeError ?? undefined,
              tokenUsage
            });
          }
        });

        // Handle process close
        currentProcess.on('close', (code) => {
          const exitCode = code ?? -1;
          const success = exitCode === 0 && !timedOut && !aborted;

          // Detect agent-specific errors (currently claude only)
          const claudeError = !success && (options.agent ?? 'claude') === 'claude'
            ? errorDetector.detect(stdout, stderr)
            : undefined;

          // Parse token usage from stdout
          const tokenUsage = tokenUsageParser.parse(stdout);

          // Requirements: 7.6 - Return typed result indicating success/failure
          resolveOnce({
            success,
            exitCode,
            stdout,
            stderr,
            timedOut,
            claudeError: claudeError ?? undefined,
            tokenUsage
          });
        });

        // Handle spawn errors
        currentProcess.on('error', (error) => {
          resolveOnce({
            success: false,
            exitCode: -1,
            stdout,
            stderr: stderr || error.message,
            timedOut: false
          });
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
async function invokeInDocker(
  options: AgentInvokeOptions,
  getProcess: () => ChildProcess | null,
  setProcess: (p: ChildProcess | null) => void,
  isAborted: () => boolean,
  errorDetector: ReturnType<typeof createClaudeErrorDetector>,
  mcpConfigWriter?: ReturnType<typeof createMcpConfigWriter>,
  tokenUsageParser?: ReturnType<typeof createTokenUsageParser>
): Promise<AgentResult> {
  const agent = options.agent ?? 'claude';

  // Inject MCP configs into workspace (auto-mounted into container for claude/gemini)
  if (mcpConfigWriter && options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    await mcpConfigWriter.inject(agent, options.workingDirectory, options.mcpServers);
  }

  return new Promise((resolve) => {
    // Build docker run command
    const dockerArgs: string[] = [
      'run',
      '--rm',                                          // Remove container after exit
      '-w', '/workspace',                              // Working directory inside container
      '-v', `${options.workingDirectory}:/workspace`,  // Mount workspace
    ];

    // No special networking needed - host.docker.internal works on macOS/Windows Docker Desktop

    const agentConfig = getAgentCliConfig(options.agent);

    // Get API key from env or config files (skip if using Ollama)
    if (!options.ollama) {
      const apiKey = getApiKey(options.tier, options.agent);
      if (apiKey) {
        const envKeyName = agentConfig.envKeyName ?? 'ANTHROPIC_API_KEY';
        dockerArgs.push('-e', `${envKeyName}=${apiKey}`);
      }
    }

    // Set Ollama backend environment variables for Docker (claude-specific)
    if (options.ollama && (options.agent ?? 'claude') === 'claude') {
      // Use host.docker.internal to reach host's Ollama (works on macOS/Windows Docker Desktop)
      const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'http://host.docker.internal:11434';
      const authToken = process.env.ANTHROPIC_AUTH_TOKEN ?? 'ollama';
      dockerArgs.push('-e', `ANTHROPIC_BASE_URL=${baseUrl}`);
      dockerArgs.push('-e', `ANTHROPIC_AUTH_TOKEN=${authToken}`);
      // Set dummy API key to bypass Claude CLI validation (Ollama doesn't use it)
      dockerArgs.push('-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ?? 'sk-ollama-placeholder'}`);
    }

    // Add image
    dockerArgs.push(options.sandboxImage ?? DEFAULT_SANDBOX_IMAGE);

    // Add agent command with args (in Docker, force skip-permissions since it's isolated)
    const dockerOptions: AgentInvokeOptions = { ...options, skipPermissions: true };
    dockerArgs.push(agentConfig.binary, ...agentConfig.buildArgs(dockerOptions));

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

    // Track if we've already resolved to prevent double-resolution
    let resolved = false;
    const resolveOnce = (result: AgentResult) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        setProcess(null);

        // Cleanup injected MCP configs
        if (mcpConfigWriter && options.mcpServers && Object.keys(options.mcpServers).length > 0) {
          mcpConfigWriter.cleanup(agent, options.workingDirectory).catch(() => {});
        }

        resolve(result);
      }
    };

    // Handle process exit (fires when process terminates, before close)
    proc.on('exit', (code, signal) => {
      // If killed by signal or non-zero exit, resolve immediately
      // Don't wait for close event which may not fire in some edge cases
      if (signal || (code !== null && code !== 0)) {
        const exitCode = code ?? -1;
        const claudeError = (options.agent ?? 'claude') === 'claude'
          ? errorDetector.detect(stdout, stderr)
          : undefined;
        const tokenUsage = tokenUsageParser?.parse(stdout);

        resolveOnce({
          success: false,
          exitCode,
          stdout,
          stderr: stderr || (signal ? `Process killed by signal: ${signal}` : ''),
          timedOut,
          claudeError: claudeError ?? undefined,
          tokenUsage
        });
      }
    });

    // Handle process close (fires after all stdio streams close)
    proc.on('close', (code) => {
      const exitCode = code ?? -1;
      const success = exitCode === 0 && !timedOut && !isAborted();

      // Detect agent-specific errors (currently claude only)
      const claudeError = !success && (options.agent ?? 'claude') === 'claude'
        ? errorDetector.detect(stdout, stderr)
        : undefined;

      // Parse token usage from stdout
      const tokenUsage = tokenUsageParser?.parse(stdout);

      resolveOnce({
        success,
        exitCode,
        stdout,
        stderr,
        timedOut,
        claudeError: claudeError ?? undefined,
        tokenUsage
      });
    });

    // Handle spawn errors
    proc.on('error', (error) => {
      resolveOnce({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr || `Docker error: ${error.message}`,
        timedOut: false
      });
    });
  });
}
