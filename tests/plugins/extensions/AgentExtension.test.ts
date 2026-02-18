/**
 * AgentExtension tests - Task 5.2
 * Tests for the agent extension point.
 *
 * Requirements coverage: 5.1, 5.2, 5.3, 5.4, 5.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentExtension } from '../../../src/plugins/extensions/AgentExtension';
import { createPluginRegistry } from '../../../src/plugins/PluginRegistry';
import type {
  AgentRegistration,
  AgentAdapter,
  AgentCapability,
  PluginModule,
  LoadedPlugin,
} from '../../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockAdapter(overrides: Partial<AgentAdapter> = {}): AgentAdapter {
  return {
    invoke: vi.fn().mockResolvedValue({ success: true, output: 'test output' }),
    getCapabilities: vi.fn().mockReturnValue(['code-generation'] as AgentCapability[]),
    configure: vi.fn(),
    ...overrides,
  };
}

function createMockAgentRegistration(
  name: string = 'test-agent',
  overrides: Partial<AgentRegistration> = {}
): AgentRegistration {
  return {
    name,
    description: 'A test agent',
    adapter: createMockAdapter(),
    ...overrides,
  };
}

function createMockLoadedPlugin(name: string = 'test-plugin'): LoadedPlugin {
  return {
    name,
    version: '1.0.0',
    manifest: {
      name,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test',
      entryPoint: './index.js',
      red64CliVersion: '^1.0.0',
      extensionPoints: ['agents'],
    },
  };
}

function createMockModule(): PluginModule {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentExtension', () => {
  let registry: ReturnType<typeof createPluginRegistry>;
  let agentExtension: ReturnType<typeof createAgentExtension>;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(() => {
    registry = createPluginRegistry();
    logMessages = [];
    agentExtension = createAgentExtension({
      registry,
      logger: (level, message) => {
        logMessages.push({ level, message });
      },
    });
  });

  describe('registerAgent', () => {
    it('accepts agent adapter registrations from plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const registration = createMockAgentRegistration('custom-agent');

      agentExtension.registerAgent('my-plugin', registration);

      const agent = agentExtension.getAgent('custom-agent');
      expect(agent).toBeDefined();
      expect(agent?.pluginName).toBe('my-plugin');
      expect(agent?.registration.name).toBe('custom-agent');
    });

    it('validates that agent name does not conflict with built-in agent "claude"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        agentExtension.registerAgent('my-plugin', createMockAgentRegistration('claude'));
      }).toThrow(/conflicts with/i);
    });

    it('validates that agent name does not conflict with built-in agent "gemini"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        agentExtension.registerAgent('my-plugin', createMockAgentRegistration('gemini'));
      }).toThrow(/conflicts with/i);
    });

    it('validates that agent name does not conflict with built-in agent "codex"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        agentExtension.registerAgent('my-plugin', createMockAgentRegistration('codex'));
      }).toThrow(/conflicts with/i);
    });

    it('rejects conflicting registrations from other plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      agentExtension.registerAgent('plugin-a', createMockAgentRegistration('shared-agent'));

      expect(() => {
        agentExtension.registerAgent('plugin-b', createMockAgentRegistration('shared-agent'));
      }).toThrow(/conflicts with agent from plugin/i);
    });
  });

  describe('invokeAgent', () => {
    it('wraps agent invocations in try/catch boundary', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const failingAdapter = createMockAdapter({
        invoke: vi.fn().mockRejectedValue(new Error('Agent invocation failed')),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('failing-agent', {
        adapter: failingAdapter,
      }));

      const result = await agentExtension.invokeAgent('failing-agent', {
        prompt: 'test prompt',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Agent invocation failed/);
    });

    it('logs errors with plugin attribution', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const failingAdapter = createMockAdapter({
        invoke: vi.fn().mockRejectedValue(new Error('Agent error')),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('failing-agent', {
        adapter: failingAdapter,
      }));

      await agentExtension.invokeAgent('failing-agent', {
        prompt: 'test',
        workingDirectory: '/tmp',
      });

      expect(logMessages.some(m =>
        m.level === 'error' &&
        m.message.includes('my-plugin') &&
        m.message.includes('Agent error')
      )).toBe(true);
    });

    it('propagates a standardized error to the workflow engine', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const failingAdapter = createMockAdapter({
        invoke: vi.fn().mockRejectedValue(new Error('Original error')),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('failing-agent', {
        adapter: failingAdapter,
      }));

      const result = await agentExtension.invokeAgent('failing-agent', {
        prompt: 'test',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.pluginName).toBe('my-plugin');
      expect(result.error).toBeDefined();
    });

    it('returns success result from agent adapter', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const successAdapter = createMockAdapter({
        invoke: vi.fn().mockResolvedValue({
          success: true,
          output: 'Generated code here',
        }),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('success-agent', {
        adapter: successAdapter,
      }));

      const result = await agentExtension.invokeAgent('success-agent', {
        prompt: 'Generate code',
        workingDirectory: '/tmp',
        model: 'gpt-4',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Generated code here');
      expect(successAdapter.invoke).toHaveBeenCalledWith({
        prompt: 'Generate code',
        workingDirectory: '/tmp',
        model: 'gpt-4',
      });
    });

    it('returns error for non-existent agent', async () => {
      const result = await agentExtension.invokeAgent('non-existent', {
        prompt: 'test',
        workingDirectory: '/tmp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('getAgent (lookup for AgentInvoker)', () => {
    it('exposes a lookup function to resolve custom agents', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('custom-agent'));

      const agent = agentExtension.getAgent('custom-agent');

      expect(agent).toBeDefined();
      expect(agent?.registration.name).toBe('custom-agent');
    });

    it('returns undefined for non-existent agent', () => {
      const agent = agentExtension.getAgent('non-existent');

      expect(agent).toBeUndefined();
    });
  });

  describe('getCapabilities (capability query)', () => {
    it('supports capability declaration for workflow engine queries', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const adapter = createMockAdapter({
        getCapabilities: vi.fn().mockReturnValue([
          'code-generation',
          'code-review',
          'testing',
        ] as AgentCapability[]),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('capable-agent', {
        adapter,
      }));

      const capabilities = agentExtension.getAgentCapabilities('capable-agent');

      expect(capabilities).toEqual(['code-generation', 'code-review', 'testing']);
    });

    it('returns empty array for non-existent agent', () => {
      const capabilities = agentExtension.getAgentCapabilities('non-existent');

      expect(capabilities).toEqual([]);
    });

    it('allows workflow engine to query which operations a custom agent supports', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const adapter = createMockAdapter({
        getCapabilities: vi.fn().mockReturnValue(['documentation', 'refactoring'] as AgentCapability[]),
      });
      agentExtension.registerAgent('my-plugin', createMockAgentRegistration('doc-agent', { adapter }));

      const capabilities = agentExtension.getAgentCapabilities('doc-agent');

      expect(capabilities).toContain('documentation');
      expect(capabilities).toContain('refactoring');
      expect(capabilities).not.toContain('code-generation');
    });
  });

  describe('getAllAgents', () => {
    it('returns all registered plugin agents', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      agentExtension.registerAgent('plugin-a', createMockAgentRegistration('agent-a'));
      agentExtension.registerAgent('plugin-b', createMockAgentRegistration('agent-b'));

      const agents = agentExtension.getAllAgents();

      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.registration.name)).toContain('agent-a');
      expect(agents.map(a => a.registration.name)).toContain('agent-b');
    });
  });
});
