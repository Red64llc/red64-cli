import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPhaseExecutor, type PhaseExecutorService } from '../../src/services/PhaseExecutor.js';
import type { AgentInvokerService } from '../../src/services/AgentInvoker.js';
import type { StateStoreService } from '../../src/services/StateStore.js';
import type { FlowPhase, GlobalFlags, AgentResult } from '../../src/types/index.js';

describe('PhaseExecutor', () => {
  let mockAgentInvoker: AgentInvokerService;
  let mockStateStore: StateStoreService;
  let executor: PhaseExecutorService;

  const defaultFlags: GlobalFlags = {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false
  };

  const successResult: AgentResult = {
    success: true,
    exitCode: 0,
    stdout: 'Generation successful',
    stderr: '',
    timedOut: false
  };

  const failureResult: AgentResult = {
    success: false,
    exitCode: 1,
    stdout: '',
    stderr: 'Generation failed',
    timedOut: false
  };

  beforeEach(() => {
    mockAgentInvoker = {
      invoke: vi.fn().mockResolvedValue(successResult),
      abort: vi.fn()
    };

    mockStateStore = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false)
    };

    executor = createPhaseExecutor(mockAgentInvoker, mockStateStore);
  });

  describe('execute', () => {
    it('should invoke agent for requirements-generating phase', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('requirements'),
          workingDirectory: '/test/dir'
        })
      );
      expect(result.success).toBe(true);
    });

    it('should invoke agent for design-generating phase', async () => {
      const phase: FlowPhase = {
        type: 'design-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('design')
        })
      );
      expect(result.success).toBe(true);
    });

    it('should invoke agent for tasks-generating phase', async () => {
      const phase: FlowPhase = {
        type: 'tasks-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('tasks')
        })
      );
      expect(result.success).toBe(true);
    });

    it('should invoke agent for implementing phase', async () => {
      const phase: FlowPhase = {
        type: 'implementing',
        feature: 'test-feature',
        currentTask: 1,
        totalTasks: 5
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('impl')
        })
      );
      expect(result.success).toBe(true);
    });

    it('should pass skipPermissions flag to agent', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };
      const flags = { ...defaultFlags, skipPermissions: true };

      await executor.execute(phase, flags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPermissions: true
        })
      );
    });

    it('should pass tier to agent', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };
      const flags = { ...defaultFlags, tier: 'premium' };

      await executor.execute(phase, flags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'premium'
        })
      );
    });

    it('should not pass workflow state to agent', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      await executor.execute(phase, defaultFlags, '/test/dir');

      // The prompt should NOT contain workflow state or next-step instructions
      const invokeCall = (mockAgentInvoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(invokeCall.prompt).not.toContain('next step');
      expect(invokeCall.prompt).not.toContain('workflow state');
      expect(invokeCall.prompt).not.toContain('after this');
    });

    it('should return success when agent succeeds', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should return error when agent fails', async () => {
      (mockAgentInvoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue(failureResult);

      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should not invoke agent for review phases', async () => {
      const phase: FlowPhase = {
        type: 'requirements-review',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).not.toHaveBeenCalled();
      expect(result.success).toBe(true); // Review phases just wait for user input
    });

    it('should not invoke agent for idle phase', async () => {
      const phase: FlowPhase = { type: 'idle' };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should use red64: prefix for slash commands in prompts', async () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      await executor.execute(phase, defaultFlags, '/test/dir');

      const invokeCall = (mockAgentInvoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(invokeCall.prompt).toContain('/red64:');
    });
  });

  describe('retry logic', () => {
    it('should retry on failure up to max attempts', async () => {
      (mockAgentInvoker.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(failureResult)
        .mockResolvedValueOnce(failureResult)
        .mockResolvedValueOnce(successResult);

      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      expect(mockAgentInvoker.invoke).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should return error after max retries exhausted', async () => {
      (mockAgentInvoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue(failureResult);

      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };

      const result = await executor.execute(phase, defaultFlags, '/test/dir');

      // Default max retries is 3
      expect(mockAgentInvoker.invoke).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.error).toContain('retries');
    });
  });
});
