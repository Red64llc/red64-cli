import { describe, it, expect } from 'vitest';
import type {
  AgentInvokeOptions,
  AgentResult
} from '../../src/types/index.js';

describe('Agent Invocation Types', () => {
  describe('AgentInvokeOptions', () => {
    it('should have required prompt field', () => {
      const options: AgentInvokeOptions = {
        prompt: 'Generate requirements for feature X',
        workingDirectory: '/path/to/project',
        skipPermissions: false,
        tier: undefined
      };

      expect(options.prompt).toBe('Generate requirements for feature X');
    });

    it('should have required workingDirectory field', () => {
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/Users/test/project',
        skipPermissions: false,
        tier: undefined
      };

      expect(options.workingDirectory).toBe('/Users/test/project');
    });

    it('should have skipPermissions flag', () => {
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/path',
        skipPermissions: true,
        tier: undefined
      };

      expect(options.skipPermissions).toBe(true);
    });

    it('should support tier option', () => {
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/path',
        skipPermissions: false,
        tier: 'custom-tier'
      };

      expect(options.tier).toBe('custom-tier');
    });

    it('should support optional onOutput callback', () => {
      const outputChunks: string[] = [];
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/path',
        skipPermissions: false,
        tier: undefined,
        onOutput: (chunk: string) => outputChunks.push(chunk)
      };

      options.onOutput?.('test chunk');
      expect(outputChunks).toContain('test chunk');
    });

    it('should support optional onError callback', () => {
      const errorChunks: string[] = [];
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/path',
        skipPermissions: false,
        tier: undefined,
        onError: (chunk: string) => errorChunks.push(chunk)
      };

      options.onError?.('error chunk');
      expect(errorChunks).toContain('error chunk');
    });

    it('should support optional timeout', () => {
      const options: AgentInvokeOptions = {
        prompt: 'Test prompt',
        workingDirectory: '/path',
        skipPermissions: false,
        tier: undefined,
        timeout: 30000
      };

      expect(options.timeout).toBe(30000);
    });
  });

  describe('AgentResult', () => {
    it('should have success flag', () => {
      const result: AgentResult = {
        success: true,
        exitCode: 0,
        stdout: 'Generated output',
        stderr: '',
        timedOut: false
      };

      expect(result.success).toBe(true);
    });

    it('should have exitCode', () => {
      const result: AgentResult = {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error occurred',
        timedOut: false
      };

      expect(result.exitCode).toBe(1);
    });

    it('should have stdout', () => {
      const result: AgentResult = {
        success: true,
        exitCode: 0,
        stdout: 'Command output here',
        stderr: '',
        timedOut: false
      };

      expect(result.stdout).toBe('Command output here');
    });

    it('should have stderr', () => {
      const result: AgentResult = {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error message',
        timedOut: false
      };

      expect(result.stderr).toBe('Error message');
    });

    it('should have timedOut flag', () => {
      const result: AgentResult = {
        success: false,
        exitCode: -1,
        stdout: 'Partial output',
        stderr: '',
        timedOut: true
      };

      expect(result.timedOut).toBe(true);
    });

    it('should indicate successful completion', () => {
      const result: AgentResult = {
        success: true,
        exitCode: 0,
        stdout: 'Generated requirements successfully',
        stderr: '',
        timedOut: false
      };

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('should indicate failed completion', () => {
      const result: AgentResult = {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Claude CLI not found',
        timedOut: false
      };

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should indicate timeout', () => {
      const result: AgentResult = {
        success: false,
        exitCode: -1,
        stdout: 'Partial...',
        stderr: '',
        timedOut: true
      };

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
    });
  });
});
