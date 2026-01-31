/**
 * Task Runner Service
 * Task 4.2: Implement task runner for incremental implementation execution
 * Requirements: 5.2, 5.3, 5.4
 */

import type { AgentInvokerService } from './AgentInvoker.js';
import type { CommitServiceInterface } from './CommitService.js';
import type { TaskParserService, Task } from './TaskParser.js';
import type { GlobalFlags } from '../types/index.js';

/**
 * Checkpoint decision type
 * Requirements: 5.5 - Support continue, pause, and abort at checkpoints
 */
export type CheckpointDecision = 'continue' | 'pause' | 'abort';

/**
 * Task execution options
 * Requirements: 5.2 - Execute tasks with configurable options
 */
export interface TaskExecutionOptions {
  readonly feature: string;
  readonly specDir: string;
  readonly workingDir: string;
  readonly startFromTask: number;
  readonly onProgress: (current: number, total: number, task: Task) => void;
  readonly onCheckpoint: (current: number, total: number) => Promise<CheckpointDecision>;
  readonly flags: GlobalFlags;
}

/**
 * Task execution result
 * Requirements: 5.4 - Track progress and completion
 */
export interface TaskExecutionResult {
  readonly success: boolean;
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly pausedAt: number | undefined;
  readonly error: string | undefined;
}

/**
 * Task runner service interface
 * Requirements: 5.2, 5.3, 5.4
 */
export interface TaskRunnerService {
  execute(options: TaskExecutionOptions): Promise<TaskExecutionResult>;
  abort(): void;
}

/**
 * Checkpoint interval - trigger checkpoint every N tasks
 * Requirements: 5.5 - Checkpoint every 3 tasks
 */
const CHECKPOINT_INTERVAL = 3;

/**
 * Generate task prompt for agent invocation
 */
function generateTaskPrompt(task: Task, feature: string): string {
  return `Execute implementation task ${task.id} for feature "${feature}":

Task: ${task.title}

Description:
${task.description}

Instructions:
1. Implement the task as described
2. Write tests before implementation (TDD)
3. Ensure all existing tests pass
4. Follow the project's coding standards
`;
}

/**
 * Create task runner service
 * Requirements: 5.2, 5.3, 5.4 - Factory function for task execution
 */
export function createTaskRunner(
  agentInvoker: AgentInvokerService,
  commitService: CommitServiceInterface,
  taskParser: TaskParserService
): TaskRunnerService {
  let aborted = false;

  return {
    /**
     * Execute tasks sequentially
     * Requirements: 5.2 - Execute tasks in order via AgentInvoker
     * Requirements: 5.3 - Commit after each successful task
     * Requirements: 5.4 - Report progress to callback
     */
    async execute(options: TaskExecutionOptions): Promise<TaskExecutionResult> {
      aborted = false;

      // Parse tasks from spec directory
      const allTasks = await taskParser.parse(options.specDir);
      const pendingTasks = taskParser.getPendingTasks(allTasks);

      // Start from specified index
      const tasksToExecute = pendingTasks.slice(options.startFromTask);
      const totalTasks = pendingTasks.length;

      if (tasksToExecute.length === 0) {
        return {
          success: true,
          completedTasks: 0,
          totalTasks,
          pausedAt: undefined,
          error: undefined
        };
      }

      let completedCount = options.startFromTask;

      for (const task of tasksToExecute) {
        // Check for abort
        if (aborted) {
          return {
            success: false,
            completedTasks: completedCount,
            totalTasks,
            pausedAt: undefined,
            error: 'Execution aborted'
          };
        }

        // Invoke agent for task
        const prompt = generateTaskPrompt(task, options.feature);
        const result = await agentInvoker.invoke({
          prompt,
          workingDirectory: options.workingDir,
          skipPermissions: options.flags.skipPermissions,
          tier: options.flags.tier,
          agent: options.flags.agent
        });

        if (!result.success) {
          return {
            success: false,
            completedTasks: completedCount,
            totalTasks,
            pausedAt: undefined,
            error: result.stderr || 'Agent execution failed'
          };
        }

        // Commit changes after successful task
        const commitMessage = commitService.formatTaskCommitMessage(
          options.feature,
          completedCount + 1,
          task.title
        );
        await commitService.stageAndCommit(options.workingDir, commitMessage);

        completedCount++;

        // Report progress
        options.onProgress(completedCount, totalTasks, task);

        // Check for checkpoint (every 3 tasks)
        if (completedCount % CHECKPOINT_INTERVAL === 0) {
          const decision = await options.onCheckpoint(completedCount, totalTasks);

          if (decision === 'pause') {
            return {
              success: true,
              completedTasks: completedCount,
              totalTasks,
              pausedAt: completedCount,
              error: undefined
            };
          }

          if (decision === 'abort') {
            return {
              success: false,
              completedTasks: completedCount,
              totalTasks,
              pausedAt: undefined,
              error: 'Execution aborted by user'
            };
          }
        }
      }

      return {
        success: true,
        completedTasks: completedCount,
        totalTasks,
        pausedAt: undefined,
        error: undefined
      };
    },

    /**
     * Abort running task execution
     * Requirements: 5.6 - Allow abort at any point
     */
    abort(): void {
      aborted = true;
      agentInvoker.abort();
    }
  };
}
