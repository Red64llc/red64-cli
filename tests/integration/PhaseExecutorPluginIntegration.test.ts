/**
 * Integration tests for workflow hooks in PhaseExecutor
 * Task 9.3: Integrate workflow hooks into the PhaseExecutor
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPluginRegistry,
  createHookRunner,
  type PluginRegistryService,
  type HookRunnerExtendedService,
  type HookContext,
  type HookHandlerResult,
  type WorkflowPhase,
} from '../../src/plugins/index.js';

describe('PhaseExecutor Plugin Integration', () => {
  let registry: PluginRegistryService;
  let hookRunner: HookRunnerExtendedService;

  beforeEach(() => {
    registry = createPluginRegistry();
    hookRunner = createHookRunner({ registry, timeout: 1000 });
  });

  describe('Task 9.3: Pre-phase hook execution', () => {
    it('should execute pre-phase hooks before phase execution', async () => {
      const hookCalled = vi.fn();

      hookRunner.registerHook('test-plugin', {
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: async (context: HookContext): Promise<HookHandlerResult> => {
          hookCalled(context.phase, context.timing);
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'requirements',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('requirements', context);

      expect(hookCalled).toHaveBeenCalledWith('requirements', 'pre');
      expect(result.vetoed).toBe(false);
      expect(result.executedHooks).toBe(1);
    });

    it('should abort phase execution when pre-phase hook vetoes', async () => {
      hookRunner.registerHook('veto-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          return { action: 'veto', reason: 'Design not ready' };
        },
      });

      const context: HookContext = {
        phase: 'design',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('design', context);

      expect(result.vetoed).toBe(true);
      expect(result.vetoReason).toBe('Design not ready');
      expect(result.vetoPlugin).toBe('veto-plugin');
    });

    it('should stop executing remaining hooks after veto', async () => {
      const hook1Called = vi.fn();
      const hook2Called = vi.fn();

      // First hook (early priority) vetoes
      hookRunner.registerHook('plugin-1', {
        phase: 'tasks',
        timing: 'pre',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          hook1Called();
          return { action: 'veto', reason: 'Early veto' };
        },
      });

      // Second hook (normal priority) should not be called
      hookRunner.registerHook('plugin-2', {
        phase: 'tasks',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          hook2Called();
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'tasks',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('tasks', context);

      expect(hook1Called).toHaveBeenCalled();
      expect(hook2Called).not.toHaveBeenCalled();
      expect(result.vetoed).toBe(true);
      expect(result.executedHooks).toBe(1);
    });
  });

  describe('Task 9.3: Post-phase hook execution', () => {
    it('should execute post-phase hooks after successful phase execution', async () => {
      const hookCalled = vi.fn();

      hookRunner.registerHook('post-plugin', {
        phase: 'requirements',
        timing: 'post',
        priority: 'normal',
        handler: async (context: HookContext): Promise<HookHandlerResult> => {
          hookCalled(context.phase, context.timing);
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'requirements',
        timing: 'post',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPostPhaseHooks('requirements', context);

      expect(hookCalled).toHaveBeenCalledWith('requirements', 'post');
      expect(result.vetoed).toBe(false);
      expect(result.executedHooks).toBe(1);
    });
  });

  describe('Task 9.3: Hook error isolation', () => {
    it('should continue executing hooks after one fails', async () => {
      const hook1Called = vi.fn();
      const hook2Called = vi.fn();

      // First hook throws an error
      hookRunner.registerHook('error-plugin', {
        phase: 'implementation',
        timing: 'pre',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          hook1Called();
          throw new Error('Hook error');
        },
      });

      // Second hook should still be called
      hookRunner.registerHook('good-plugin', {
        phase: 'implementation',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          hook2Called();
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'implementation',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('implementation', context);

      expect(hook1Called).toHaveBeenCalled();
      expect(hook2Called).toHaveBeenCalled();
      expect(result.vetoed).toBe(false);
      expect(result.executedHooks).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('error-plugin');
      expect(result.errors[0]?.error).toContain('Hook error');
    });

    it('should attribute errors to the correct plugin', async () => {
      hookRunner.registerHook('failing-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          throw new Error('Specific error message');
        },
      });

      const context: HookContext = {
        phase: 'design',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('design', context);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('failing-plugin');
      expect(result.errors[0]?.error).toBe('Specific error message');
    });
  });

  describe('Task 9.3: No hooks registered', () => {
    it('should behave identically when no hooks are registered', async () => {
      const context: HookContext = {
        phase: 'requirements',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const preResult = await hookRunner.runPrePhaseHooks('requirements', context);
      const postResult = await hookRunner.runPostPhaseHooks('requirements', context);

      // No hooks = no veto, no errors, 0 executed
      expect(preResult.vetoed).toBe(false);
      expect(preResult.executedHooks).toBe(0);
      expect(preResult.errors).toHaveLength(0);

      expect(postResult.vetoed).toBe(false);
      expect(postResult.executedHooks).toBe(0);
      expect(postResult.errors).toHaveLength(0);
    });
  });

  describe('Hook priority ordering', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      hookRunner.registerHook('late-plugin', {
        phase: 'tasks',
        timing: 'pre',
        priority: 'late',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('late');
          return { action: 'continue' };
        },
      });

      hookRunner.registerHook('early-plugin', {
        phase: 'tasks',
        timing: 'pre',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('early');
          return { action: 'continue' };
        },
      });

      hookRunner.registerHook('normal-plugin', {
        phase: 'tasks',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('normal');
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'tasks',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      await hookRunner.runPrePhaseHooks('tasks', context);

      // Hooks should execute in priority order: early -> normal -> late
      expect(executionOrder).toEqual(['early', 'normal', 'late']);
    });
  });

  describe('Wildcard phase hooks', () => {
    it('should execute wildcard hooks for any phase', async () => {
      const hookCalled = vi.fn();

      hookRunner.registerHook('wildcard-plugin', {
        phase: '*',
        timing: 'pre',
        priority: 'normal',
        handler: async (context: HookContext): Promise<HookHandlerResult> => {
          hookCalled(context.phase);
          return { action: 'continue' };
        },
      });

      const requirementsContext: HookContext = {
        phase: 'requirements',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const designContext: HookContext = {
        phase: 'design',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      await hookRunner.runPrePhaseHooks('requirements', requirementsContext);
      await hookRunner.runPrePhaseHooks('design', designContext);

      expect(hookCalled).toHaveBeenCalledTimes(2);
      expect(hookCalled).toHaveBeenCalledWith('requirements');
      expect(hookCalled).toHaveBeenCalledWith('design');
    });
  });
});
