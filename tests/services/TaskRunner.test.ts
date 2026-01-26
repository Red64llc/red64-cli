/**
 * Task Runner Tests
 * Task 4.2: Implement task runner for incremental implementation execution
 * Requirements: 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTaskRunner,
  type TaskRunnerService,
  type TaskExecutionOptions,
  type TaskExecutionResult,
  type CheckpointDecision
} from '../../src/services/TaskRunner.js';
import type { AgentInvokerService, AgentResult } from '../../src/services/AgentInvoker.js';
import type { CommitServiceInterface, CommitResult } from '../../src/services/CommitService.js';
import type { TaskParserService, Task } from '../../src/services/TaskParser.js';
import type { GlobalFlags } from '../../src/types/index.js';

describe('TaskRunner', () => {
  let taskRunner: TaskRunnerService;
  let mockAgentInvoker: AgentInvokerService;
  let mockCommitService: CommitServiceInterface;
  let mockTaskParser: TaskParserService;

  const defaultFlags: GlobalFlags = {
    skipPermissions: true,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false
  };

  const sampleTasks: Task[] = [
    { id: '1.1', title: 'First task', description: 'Do first thing', completed: false, priority: false, hasAsterisk: false },
    { id: '1.2', title: 'Second task', description: 'Do second thing', completed: false, priority: false, hasAsterisk: false },
    { id: '2.1', title: 'Third task', description: 'Do third thing', completed: false, priority: false, hasAsterisk: false },
    { id: '2.2', title: 'Fourth task', description: 'Do fourth thing', completed: false, priority: false, hasAsterisk: false },
    { id: '3.1', title: 'Fifth task', description: 'Do fifth thing', completed: false, priority: false, hasAsterisk: false }
  ];

  beforeEach(() => {
    mockAgentInvoker = {
      invoke: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Task completed',
        stderr: '',
        timedOut: false
      } as AgentResult),
      abort: vi.fn()
    };

    mockCommitService = {
      stageAll: vi.fn().mockResolvedValue({ success: true, commitHash: undefined, error: undefined }),
      commit: vi.fn().mockResolvedValue({ success: true, commitHash: 'abc123', error: undefined }),
      stageAndCommit: vi.fn().mockResolvedValue({ success: true, commitHash: 'abc123', error: undefined }),
      formatTaskCommitMessage: vi.fn().mockReturnValue('feat(test): task commit'),
      formatPhaseCommitMessage: vi.fn().mockReturnValue('feat(test): phase commit')
    };

    mockTaskParser = {
      parse: vi.fn().mockResolvedValue(sampleTasks),
      getPendingTasks: vi.fn().mockReturnValue(sampleTasks),
      getTaskById: vi.fn().mockImplementation((tasks, id) => tasks.find((t: Task) => t.id === id))
    };

    taskRunner = createTaskRunner(mockAgentInvoker, mockCommitService, mockTaskParser);
  });

  describe('execute', () => {
    it('should execute tasks sequentially', async () => {
      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test-feature',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      const result = await taskRunner.execute(options);

      expect(result.success).toBe(true);
      expect(result.completedTasks).toBe(5);
      expect(result.totalTasks).toBe(5);
      expect(mockAgentInvoker.invoke).toHaveBeenCalledTimes(5);
    });

    it('should invoke agent for each task', async () => {
      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      await taskRunner.execute(options);

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: '/repo',
          skipPermissions: true
        })
      );
    });

    it('should commit after each successful task', async () => {
      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      await taskRunner.execute(options);

      expect(mockCommitService.stageAndCommit).toHaveBeenCalledTimes(5);
    });

    it('should report progress after each task', async () => {
      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      await taskRunner.execute(options);

      expect(onProgress).toHaveBeenCalledTimes(5);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 5, expect.objectContaining({ id: '1.1' }));
      expect(onProgress).toHaveBeenNthCalledWith(5, 5, 5, expect.objectContaining({ id: '3.1' }));
    });

    it('should support starting from a specific task index', async () => {
      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 2, // Start from third task (index 2)
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      const result = await taskRunner.execute(options);

      // Only 3 tasks should be executed (index 2, 3, 4 of 5 total)
      expect(mockAgentInvoker.invoke).toHaveBeenCalledTimes(3);
      // completedTasks includes the startFromTask offset
      expect(result.completedTasks).toBe(5);
    });

    it('should handle agent failures', async () => {
      mockAgentInvoker.invoke = vi.fn()
        .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: '', stderr: '', timedOut: false })
        .mockResolvedValueOnce({ success: false, exitCode: 1, stdout: '', stderr: 'Agent error', timedOut: false });

      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      const result = await taskRunner.execute(options);

      expect(result.success).toBe(false);
      expect(result.completedTasks).toBe(1);
      expect(result.error).toBeDefined();
    });
  });

  describe('abort', () => {
    it('should stop execution when abort is called', async () => {
      // Make agent take time so we can abort
      mockAgentInvoker.invoke = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true, exitCode: 0, stdout: '', stderr: '', timedOut: false
        }), 100))
      );

      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      // Start execution and abort after a short delay
      const executePromise = taskRunner.execute(options);
      taskRunner.abort();

      const result = await executePromise;

      expect(mockAgentInvoker.abort).toHaveBeenCalled();
    });
  });

  describe('checkpoint behavior', () => {
    it('should trigger checkpoint every 3 tasks', async () => {
      const sixTasks: Task[] = [
        { id: '1.1', title: 'Task 1', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '1.2', title: 'Task 2', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '1.3', title: 'Task 3', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '2.1', title: 'Task 4', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '2.2', title: 'Task 5', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '2.3', title: 'Task 6', description: '', completed: false, priority: false, hasAsterisk: false }
      ];
      mockTaskParser.parse = vi.fn().mockResolvedValue(sixTasks);
      mockTaskParser.getPendingTasks = vi.fn().mockReturnValue(sixTasks);

      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('continue' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      await taskRunner.execute(options);

      // Should checkpoint at task 3 and task 6
      expect(onCheckpoint).toHaveBeenCalledTimes(2);
      expect(onCheckpoint).toHaveBeenNthCalledWith(1, 3, 6);
      expect(onCheckpoint).toHaveBeenNthCalledWith(2, 6, 6);
    });

    it('should pause when checkpoint returns pause', async () => {
      const onProgress = vi.fn();
      // Return 'pause' at first checkpoint (after 3 tasks)
      const onCheckpoint = vi.fn().mockResolvedValue('pause' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      const result = await taskRunner.execute(options);

      expect(result.success).toBe(true);
      expect(result.pausedAt).toBe(3); // Paused after 3 tasks
      expect(result.completedTasks).toBe(3);
    });

    it('should abort when checkpoint returns abort', async () => {
      const sixTasks: Task[] = [
        { id: '1.1', title: 'Task 1', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '1.2', title: 'Task 2', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '1.3', title: 'Task 3', description: '', completed: false, priority: false, hasAsterisk: false },
        { id: '2.1', title: 'Task 4', description: '', completed: false, priority: false, hasAsterisk: false },
      ];
      mockTaskParser.parse = vi.fn().mockResolvedValue(sixTasks);
      mockTaskParser.getPendingTasks = vi.fn().mockReturnValue(sixTasks);

      const onProgress = vi.fn();
      const onCheckpoint = vi.fn().mockResolvedValue('abort' as CheckpointDecision);

      const options: TaskExecutionOptions = {
        feature: 'test',
        specDir: '/spec',
        workingDir: '/repo',
        startFromTask: 0,
        onProgress,
        onCheckpoint,
        flags: defaultFlags
      };

      const result = await taskRunner.execute(options);

      expect(result.success).toBe(false);
      expect(result.completedTasks).toBe(3);
    });
  });
});
