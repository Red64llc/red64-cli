/**
 * Integration tests for plugin agents in AgentInvoker
 * Task 9.2: Integrate plugin agents into the AgentInvoker
 * Requirements: 5.1, 5.3, 5.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentInvoker, type AgentInvokerService } from '../../src/services/AgentInvoker.js';
import {
  createPluginRegistry,
  createAgentExtension,
  type PluginRegistryService,
  type AgentExtensionService,
  type AgentAdapter,
  type AgentAdapterInvokeOptions,
  type AgentAdapterResult,
  type AgentCapability,
} from '../../src/plugins/index.js';

/**
 * Mock agent adapter for testing
 */
function createMockAgentAdapter(
  result: Partial<AgentAdapterResult> = {},
  capabilities: AgentCapability[] = ['code-generation']
): AgentAdapter {
  return {
    invoke: vi.fn().mockResolvedValue({
      success: true,
      output: 'Mock agent output',
      ...result,
    }),
    getCapabilities: vi.fn().mockReturnValue(capabilities),
    configure: vi.fn(),
  };
}

describe('AgentInvoker Plugin Integration', () => {
  let registry: PluginRegistryService;
  let agentExtension: AgentExtensionService;

  beforeEach(() => {
    registry = createPluginRegistry();
    agentExtension = createAgentExtension({ registry });
  });

  describe('Task 9.2: Plugin agent fallback lookup', () => {
    it('should delegate to plugin agent adapter when agent not built-in', async () => {
      // Register a custom agent
      const mockAdapter = createMockAgentAdapter({ output: 'Custom agent response' });
      agentExtension.registerAgent('test-plugin', {
        name: 'custom-llm',
        description: 'A custom LLM agent',
        adapter: mockAdapter,
      });

      // Invoke the custom agent through the extension
      const result = await agentExtension.invokeAgent('custom-llm', {
        prompt: 'Hello world',
        workingDirectory: '/tmp',
      });

      // Verify the adapter was called
      expect(mockAdapter.invoke).toHaveBeenCalledWith({
        prompt: 'Hello world',
        workingDirectory: '/tmp',
      });
      expect(result.success).toBe(true);
      expect(result.output).toBe('Custom agent response');
      expect(result.pluginName).toBe('test-plugin');
    });

    it('should return error result when custom agent not found', async () => {
      const result = await agentExtension.invokeAgent('nonexistent-agent', {
        prompt: 'Hello',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should wrap adapter errors with plugin attribution', async () => {
      // Register an agent that throws
      const errorAdapter = createMockAgentAdapter();
      (errorAdapter.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Adapter crashed')
      );

      agentExtension.registerAgent('error-plugin', {
        name: 'error-agent',
        description: 'An agent that errors',
        adapter: errorAdapter,
      });

      const result = await agentExtension.invokeAgent('error-agent', {
        prompt: 'This will fail',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Adapter crashed');
      expect(result.pluginName).toBe('error-plugin');
    });

    it('should propagate standardized error result for adapter failures', async () => {
      // Register an agent that returns a failure result
      const failingAdapter = createMockAgentAdapter({
        success: false,
        output: '',
        error: 'API rate limited',
      });

      agentExtension.registerAgent('rate-limited-plugin', {
        name: 'rate-limited-agent',
        description: 'An agent that is rate limited',
        adapter: failingAdapter,
      });

      const result = await agentExtension.invokeAgent('rate-limited-agent', {
        prompt: 'Please respond',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limited');
    });
  });

  describe('Agent capability queries', () => {
    it('should return capabilities for registered agents', () => {
      const mockAdapter = createMockAgentAdapter({}, ['code-generation', 'code-review', 'testing']);
      agentExtension.registerAgent('capable-plugin', {
        name: 'capable-agent',
        description: 'An agent with many capabilities',
        adapter: mockAdapter,
      });

      const capabilities = agentExtension.getAgentCapabilities('capable-agent');

      expect(capabilities).toContain('code-generation');
      expect(capabilities).toContain('code-review');
      expect(capabilities).toContain('testing');
      expect(capabilities).toHaveLength(3);
    });

    it('should return empty array for unknown agent capabilities', () => {
      const capabilities = agentExtension.getAgentCapabilities('unknown-agent');
      expect(capabilities).toEqual([]);
    });
  });

  describe('Built-in agent protection', () => {
    it('should prevent registration of agent named "claude"', () => {
      const mockAdapter = createMockAgentAdapter();

      expect(() => {
        agentExtension.registerAgent('bad-plugin', {
          name: 'claude',
          description: 'Trying to override claude',
          adapter: mockAdapter,
        });
      }).toThrow(/conflicts with built-in agent/);
    });

    it('should prevent registration of agent named "gemini"', () => {
      const mockAdapter = createMockAgentAdapter();

      expect(() => {
        agentExtension.registerAgent('bad-plugin', {
          name: 'gemini',
          description: 'Trying to override gemini',
          adapter: mockAdapter,
        });
      }).toThrow(/conflicts with built-in agent/);
    });

    it('should prevent registration of agent named "codex"', () => {
      const mockAdapter = createMockAgentAdapter();

      expect(() => {
        agentExtension.registerAgent('bad-plugin', {
          name: 'codex',
          description: 'Trying to override codex',
          adapter: mockAdapter,
        });
      }).toThrow(/conflicts with built-in agent/);
    });
  });

  describe('Cross-plugin conflict detection', () => {
    it('should prevent duplicate agent registration from different plugins', () => {
      const mockAdapter1 = createMockAgentAdapter();
      const mockAdapter2 = createMockAgentAdapter();

      // First registration should succeed
      agentExtension.registerAgent('plugin-a', {
        name: 'shared-agent',
        description: 'First registration',
        adapter: mockAdapter1,
      });

      // Second registration with same name should fail
      expect(() => {
        agentExtension.registerAgent('plugin-b', {
          name: 'shared-agent',
          description: 'Second registration',
          adapter: mockAdapter2,
        });
      }).toThrow(/conflicts with agent from plugin/);
    });
  });
});
