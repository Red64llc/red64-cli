import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAgentInvoker, type AgentInvokerService } from '../../src/services/AgentInvoker.js';
import type { AgentInvokeOptions, AgentResult } from '../../src/types/index.js';

// Mock child_process spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

describe('AgentInvoker', () => {
  let invoker: AgentInvokerService;

  beforeEach(() => {
    vi.clearAllMocks();
    invoker = createAgentInvoker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('invoke', () => {
    it('should spawn claude CLI with prompt', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      // Create mock process
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('Generated output')), 10);
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Generate requirements',
        workingDirectory: '/test/project',
        skipPermissions: false,
        tier: undefined
      };

      const result = await invoker.invoke(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['-p', 'Generate requirements']),
        expect.objectContaining({
          cwd: '/test/project'
        })
      );
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated output');
    });

    it('should pass skip-permissions flag when configured', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: true,
        tier: undefined
      };

      await invoker.invoke(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--dangerously-skip-permissions']),
        expect.any(Object)
      );
    });

    it('should set CLAUDE_CONFIG_DIR when tier is specified', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: 'premium'
      };

      await invoker.invoke(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CLAUDE_CONFIG_DIR: expect.stringContaining('.claude-premium')
          })
        })
      );
    });

    it('should set ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN when ollama is enabled', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        ollama: true
      };

      await invoker.invoke(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            ANTHROPIC_BASE_URL: 'http://localhost:11434',
            ANTHROPIC_AUTH_TOKEN: 'ollama'
          })
        })
      );
    });

    it('should not set Ollama env vars when ollama is false', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        ollama: false
      };

      await invoker.invoke(options);

      const spawnCall = mockSpawn.mock.calls[0];
      const env = spawnCall[2].env;

      // Should not have Ollama-specific env vars set (unless already in process.env)
      expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
      expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    });

    it('should respect existing ANTHROPIC_BASE_URL when ollama is enabled', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      // Set custom base URL in environment
      const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
      process.env.ANTHROPIC_BASE_URL = 'http://custom-ollama:8080';

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        ollama: true
      };

      await invoker.invoke(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            ANTHROPIC_BASE_URL: 'http://custom-ollama:8080'
          })
        })
      );

      // Restore original env
      if (originalBaseUrl) {
        process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
      } else {
        delete process.env.ANTHROPIC_BASE_URL;
      }
    });

    it('should capture stderr', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('Error message')), 10);
            }
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 20);
          }
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined
      };

      const result = await invoker.invoke(options);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error message');
    });

    it('should call onOutput callback for stdout chunks', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      let stdoutCallback: ((data: Buffer) => void) | null = null;

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              stdoutCallback = callback;
            }
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // Trigger close after a delay to allow data events
            setTimeout(() => callback(0), 50);
          }
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const outputChunks: string[] = [];
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        onOutput: (chunk) => outputChunks.push(chunk)
      };

      const invokePromise = invoker.invoke(options);

      // Simulate stdout data
      await new Promise(resolve => setTimeout(resolve, 10));
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('chunk1'));
        stdoutCallback(Buffer.from('chunk2'));
      }

      await invokePromise;

      expect(outputChunks).toContain('chunk1');
      expect(outputChunks).toContain('chunk2');
    });

    it('should call onError callback for stderr chunks', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      let stderrCallback: ((data: Buffer) => void) | null = null;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              stderrCallback = callback;
            }
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 50);
          }
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const errorChunks: string[] = [];
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        onError: (chunk) => errorChunks.push(chunk)
      };

      const invokePromise = invoker.invoke(options);

      // Simulate stderr data
      await new Promise(resolve => setTimeout(resolve, 10));
      if (stderrCallback) {
        stderrCallback(Buffer.from('error1'));
      }

      await invokePromise;

      expect(errorChunks).toContain('error1');
    });

    it('should return timedOut true when timeout expires', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      let closeCallback: ((code: number) => void) | null = null;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(() => {
          // When killed, trigger close callback
          if (closeCallback) {
            closeCallback(-1);
          }
        })
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined,
        timeout: 50 // Very short timeout
      };

      const result = await invoker.invoke(options);

      expect(result.timedOut).toBe(true);
      expect(result.success).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalled();
    }, 10000);

    it('should return typed AgentResult', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('output'));
            }
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined
      };

      const result = await invoker.invoke(options);

      // Verify result has all required fields
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.timedOut).toBe('boolean');
    });
  });

  describe('abort', () => {
    it('should terminate running process', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = spawn as ReturnType<typeof vi.fn>;

      let closeCallback: ((code: number) => void) | null = null;

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(() => {
          // Simulate process being killed
          if (closeCallback) {
            closeCallback(-1);
          }
        })
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const options: AgentInvokeOptions = {
        prompt: 'Test',
        workingDirectory: '/test',
        skipPermissions: false,
        tier: undefined
      };

      // Start invocation
      const invokePromise = invoker.invoke(options);

      // Abort after a short delay
      await new Promise(resolve => setTimeout(resolve, 10));
      invoker.abort();

      const result = await invokePromise;

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });
});
