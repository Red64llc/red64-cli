/**
 * HookRunner tests - Task 5.3
 * Tests for the hook runner extension point.
 *
 * Requirements coverage: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHookRunner } from '../../../src/plugins/extensions/HookRunner';
import { createPluginRegistry } from '../../../src/plugins/PluginRegistry';
import type {
  HookRegistration,
  HookContext,
  HookPriority,
  WorkflowPhase,
  PluginModule,
  LoadedPlugin,
} from '../../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockHookContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    phase: 'requirements',
    timing: 'pre',
    feature: 'test-feature',
    specMetadata: { version: '1.0' },
    flowState: { status: 'active' },
    ...overrides,
  };
}

function createMockHookRegistration(
  overrides: Partial<HookRegistration> = {}
): HookRegistration {
  return {
    phase: 'requirements',
    timing: 'pre',
    priority: 'normal',
    handler: vi.fn().mockResolvedValue({ action: 'continue' }),
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
      extensionPoints: ['hooks'],
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

describe('HookRunner', () => {
  let registry: ReturnType<typeof createPluginRegistry>;
  let hookRunner: ReturnType<typeof createHookRunner>;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(() => {
    registry = createPluginRegistry();
    logMessages = [];
    hookRunner = createHookRunner({
      registry,
      logger: (level, message) => {
        logMessages.push({ level, message });
      },
      timeout: 1000, // 1 second timeout for tests
    });
  });

  describe('hook registration', () => {
    it('accepts hook registrations for pre-phase positions', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
      }));

      const hooks = registry.getHooks('requirements', 'pre');
      expect(hooks).toHaveLength(1);
    });

    it('accepts hook registrations for post-phase positions', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'design',
        timing: 'post',
      }));

      const hooks = registry.getHooks('design', 'post');
      expect(hooks).toHaveLength(1);
    });

    it('accepts hooks for all four workflow phases', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const phases: WorkflowPhase[] = ['requirements', 'design', 'tasks', 'implementation'];

      phases.forEach(phase => {
        hookRunner.registerHook('my-plugin', createMockHookRegistration({
          phase,
          timing: 'pre',
        }));
      });

      phases.forEach(phase => {
        const hooks = registry.getHooks(phase, 'pre');
        expect(hooks.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('accepts wildcard phase hooks', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: '*',
        timing: 'pre',
      }));

      // Wildcard hooks should match any phase
      const reqHooks = registry.getHooks('requirements', 'pre');
      const designHooks = registry.getHooks('design', 'pre');

      expect(reqHooks).toHaveLength(1);
      expect(designHooks).toHaveLength(1);
    });
  });

  describe('priority ordering', () => {
    it('sorts registered hooks by priority (ascending: earliest to latest)', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: string[] = [];
      const priorities: HookPriority[] = ['latest', 'early', 'normal', 'earliest', 'late'];

      priorities.forEach(priority => {
        hookRunner.registerHook('my-plugin', createMockHookRegistration({
          phase: 'requirements',
          timing: 'pre',
          priority,
          handler: vi.fn().mockImplementation(async () => {
            executionOrder.push(priority);
            return { action: 'continue' };
          }),
        }));
      });

      await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(executionOrder).toEqual(['earliest', 'early', 'normal', 'late', 'latest']);
    });

    it('maintains registration order for equal priorities (stable sort)', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: string[] = [];

      ['first', 'second', 'third'].forEach(id => {
        hookRunner.registerHook('my-plugin', createMockHookRegistration({
          phase: 'requirements',
          timing: 'pre',
          priority: 'normal',
          handler: vi.fn().mockImplementation(async () => {
            executionOrder.push(id);
            return { action: 'continue' };
          }),
        }));
      });

      await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  describe('pre-phase hooks', () => {
    it('executes pre-phase hooks sequentially', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: number[] = [];

      [1, 2, 3].forEach(id => {
        hookRunner.registerHook('my-plugin', createMockHookRegistration({
          phase: 'requirements',
          timing: 'pre',
          priority: 'normal',
          handler: vi.fn().mockImplementation(async () => {
            executionOrder.push(id);
            return { action: 'continue' };
          }),
        }));
      });

      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(executionOrder).toEqual([1, 2, 3]);
      expect(result.executedHooks).toBe(3);
    });

    it('if any hook returns a veto result, records veto reason and plugin name', async () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      hookRunner.registerHook('plugin-a', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
        priority: 'early',
        handler: vi.fn().mockResolvedValue({ action: 'continue' }),
      }));

      hookRunner.registerHook('plugin-b', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn().mockResolvedValue({
          action: 'veto',
          reason: 'Prerequisite not met',
        }),
      }));

      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.vetoed).toBe(true);
      expect(result.vetoReason).toBe('Prerequisite not met');
      expect(result.vetoPlugin).toBe('plugin-b');
    });

    it('stops executing remaining hooks after a veto', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: number[] = [];

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
        priority: 'early',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(1);
          return { action: 'continue' };
        }),
      }));

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(2);
          return { action: 'veto', reason: 'Stop here' };
        }),
      }));

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'pre',
        priority: 'late',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(3);
          return { action: 'continue' };
        }),
      }));

      await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(executionOrder).toEqual([1, 2]);
      expect(executionOrder).not.toContain(3);
    });
  });

  describe('post-phase hooks', () => {
    it('executes post-phase hooks sequentially', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: number[] = [];

      [1, 2, 3].forEach(id => {
        hookRunner.registerHook('my-plugin', createMockHookRegistration({
          phase: 'requirements',
          timing: 'post',
          priority: 'normal',
          handler: vi.fn().mockImplementation(async () => {
            executionOrder.push(id);
            return { action: 'continue' };
          }),
        }));
      });

      const result = await hookRunner.runPostPhaseHooks('requirements', createMockHookContext({
        timing: 'post',
      }));

      expect(executionOrder).toEqual([1, 2, 3]);
      expect(result.executedHooks).toBe(3);
    });

    it('vetoing is not supported in post-phase hooks (veto is ignored)', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: number[] = [];

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'post',
        priority: 'early',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(1);
          return { action: 'veto', reason: 'Should be ignored' };
        }),
      }));

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'requirements',
        timing: 'post',
        priority: 'late',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(2);
          return { action: 'continue' };
        }),
      }));

      const result = await hookRunner.runPostPhaseHooks('requirements', createMockHookContext({
        timing: 'post',
      }));

      // Both hooks should execute despite veto attempt
      expect(executionOrder).toEqual([1, 2]);
      expect(result.vetoed).toBe(false);
    });
  });

  describe('hook context', () => {
    it('passes a read-only hook context to handlers', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      let receivedContext: HookContext | null = null;
      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        phase: 'design', // Match the phase we're testing
        timing: 'pre',
        handler: vi.fn().mockImplementation(async (ctx: HookContext) => {
          receivedContext = ctx;
          return { action: 'continue' };
        }),
      }));

      const inputContext = createMockHookContext({
        phase: 'design',
        timing: 'pre',
        feature: 'my-feature',
        specMetadata: { key: 'value' },
        flowState: { step: 1 },
      });

      await hookRunner.runPrePhaseHooks('design', inputContext);

      expect(receivedContext).not.toBeNull();
      expect(receivedContext?.phase).toBe('design');
      expect(receivedContext?.timing).toBe('pre');
      expect(receivedContext?.feature).toBe('my-feature');
      expect(receivedContext?.specMetadata).toEqual({ key: 'value' });
      expect(receivedContext?.flowState).toEqual({ step: 1 });
    });
  });

  describe('error handling', () => {
    it('wraps each hook handler invocation in try/catch', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        handler: vi.fn().mockRejectedValue(new Error('Hook failed')),
      }));

      // Should not throw
      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('logs errors with plugin attribution', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        handler: vi.fn().mockRejectedValue(new Error('Handler error')),
      }));

      await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(logMessages.some(m =>
        m.level === 'error' &&
        m.message.includes('my-plugin') &&
        m.message.includes('Handler error')
      )).toBe(true);
    });

    it('continues to the next hook after an error', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const executionOrder: number[] = [];

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        priority: 'early',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(1);
          throw new Error('First hook fails');
        }),
      }));

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        priority: 'normal',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(2);
          return { action: 'continue' };
        }),
      }));

      hookRunner.registerHook('my-plugin', createMockHookRegistration({
        priority: 'late',
        handler: vi.fn().mockImplementation(async () => {
          executionOrder.push(3);
          return { action: 'continue' };
        }),
      }));

      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(executionOrder).toEqual([1, 2, 3]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('my-plugin');
    });

    it('records errors in execution result', async () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      hookRunner.registerHook('plugin-a', createMockHookRegistration({
        handler: vi.fn().mockRejectedValue(new Error('Error A')),
      }));

      hookRunner.registerHook('plugin-b', createMockHookRegistration({
        handler: vi.fn().mockRejectedValue(new Error('Error B')),
      }));

      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.errors).toHaveLength(2);
      expect(result.errors.map(e => e.pluginName)).toContain('plugin-a');
      expect(result.errors.map(e => e.pluginName)).toContain('plugin-b');
    });
  });

  describe('timeout enforcement', () => {
    it('enforces a configurable timeout per hook handler (default 30 seconds)', async () => {
      // Use a short timeout for testing
      const shortTimeoutRunner = createHookRunner({
        registry,
        logger: (level, message) => {
          logMessages.push({ level, message });
        },
        timeout: 50, // 50ms timeout
      });

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      shortTimeoutRunner.registerHook('my-plugin', createMockHookRegistration({
        handler: vi.fn().mockImplementation(async () => {
          // Simulate a slow hook
          await new Promise(resolve => setTimeout(resolve, 200));
          return { action: 'continue' };
        }),
      }));

      const result = await shortTimeoutRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.error).toMatch(/timed out/i);
    });

    it('treats timeouts as errors', async () => {
      const shortTimeoutRunner = createHookRunner({
        registry,
        logger: (level, message) => {
          logMessages.push({ level, message });
        },
        timeout: 50,
      });

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      shortTimeoutRunner.registerHook('my-plugin', createMockHookRegistration({
        handler: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { action: 'continue' };
        }),
      }));

      const result = await shortTimeoutRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('my-plugin');
    });
  });

  describe('execution result', () => {
    it('returns proper result structure for successful execution', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      hookRunner.registerHook('my-plugin', createMockHookRegistration());
      hookRunner.registerHook('my-plugin', createMockHookRegistration());

      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.vetoed).toBe(false);
      expect(result.vetoReason).toBeUndefined();
      expect(result.vetoPlugin).toBeUndefined();
      expect(result.executedHooks).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it('returns empty result when no hooks registered', async () => {
      const result = await hookRunner.runPrePhaseHooks('requirements', createMockHookContext());

      expect(result.vetoed).toBe(false);
      expect(result.executedHooks).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });
});
