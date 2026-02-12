/**
 * Task Parser Service
 * Task 4.1: Create task parser to extract tasks from tasks.md
 * Requirements: 5.1
 */

import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Task interface
 * Requirements: 5.1 - Extract task ID, title, description, completion status
 */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly completed: boolean;
  readonly priority: boolean;
  readonly hasAsterisk: boolean;
}

/**
 * Result of marking a task complete
 */
export interface MarkTaskCompleteResult {
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Task group - collection of sub-tasks under a numbered group
 * Requirement: Group-level tracking (1, 2, 3) not sub-task level (1.1, 1.2)
 */
export interface TaskGroup {
  readonly groupId: number;           // Group number (1, 2, 3, etc.)
  readonly title: string;             // Group title from tasks.md
  readonly tasks: readonly Task[];    // Sub-tasks in this group
  readonly completed: boolean;        // True if ALL sub-tasks complete
  readonly taskCount: number;         // Total sub-tasks in group
  readonly completedCount: number;    // Completed sub-tasks in group
}

/**
 * Task parser service interface
 * Requirements: 5.1
 */
export interface TaskParserService {
  parse(specDir: string): Promise<readonly Task[]>;
  getPendingTasks(tasks: readonly Task[]): readonly Task[];
  getTaskById(tasks: readonly Task[], id: string): Task | undefined;
  /**
   * Mark a task as complete in tasks.md (orchestrator-controlled)
   * Updates checkbox from [ ] to [x]
   */
  markTaskComplete(specDir: string, taskId: string): Promise<MarkTaskCompleteResult>;
  /**
   * Parse tasks into groups (1, 2, 3, etc.)
   * Requirement: Group-level tracking for progress visibility
   */
  parseGroups(specDir: string): Promise<readonly TaskGroup[]>;
  /**
   * Group tasks by their group ID (first number before the dot)
   */
  groupTasks(tasks: readonly Task[]): readonly TaskGroup[];
  /**
   * Check if a group is fully complete
   */
  isGroupComplete(tasks: readonly Task[], groupId: number): boolean;
  /**
   * Get all tasks in a specific group
   */
  getTasksInGroup(tasks: readonly Task[], groupId: number): readonly Task[];
  /**
   * Get completed groups from a task list
   */
  getCompletedGroups(tasks: readonly Task[]): readonly number[];
}

/**
 * Task line pattern
 * Matches both formats:
 *   - [ ] 1.1 Task title  (subtask format)
 *   - [ ] 1. Task title   (spec-tasks format with trailing dot)
 *   - [ ] 1 Task title    (simple number format)
 * Also handles: - [ ]* 1.1 (P) Task title
 */
const TASK_LINE_PATTERN = /^-\s+\[([ x])\](\*)?\s+(\d+(?:\.\d+)?)\.?\s+(?:\(P\)\s+)?(.+)$/;

/**
 * Extract group ID from task ID (e.g., "1.2" -> 1)
 */
function getGroupIdFromTaskId(taskId: string): number {
  const parts = taskId.split('.');
  return parseInt(parts[0], 10);
}

/**
 * Check if a line is a task line (subtask with number like 1.1, 2.3, etc.)
 */
function isTaskLine(line: string): boolean {
  return TASK_LINE_PATTERN.test(line.trim());
}

/**
 * Parse a single task line
 */
function parseTaskLine(line: string): {
  id: string;
  title: string;
  completed: boolean;
  priority: boolean;
  hasAsterisk: boolean;
} | null {
  const match = line.trim().match(TASK_LINE_PATTERN);
  if (!match) {
    return null;
  }

  const [, checkmark, asterisk, id, titlePart] = match;
  const completed = checkmark === 'x';
  const hasAsterisk = asterisk === '*';
  const priority = line.includes('(P)');
  const title = titlePart.trim();

  return { id, title, completed, priority, hasAsterisk };
}

/**
 * Parse task description from indented lines following the task line
 */
function parseDescription(lines: string[], startIndex: number): string {
  const descriptionLines: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at next task line or empty line sequence
    if (isTaskLine(line) || line.match(/^-\s+\[\s*[x ]?\s*\]\s+\d+\./)) {
      break;
    }

    // Include indented description lines (starting with -)
    if (trimmed.startsWith('-') && !trimmed.startsWith('- [')) {
      descriptionLines.push(trimmed.substring(1).trim());
    }
  }

  return descriptionLines.join('\n');
}

/**
 * Create task parser service
 * Requirements: 5.1 - Factory function for task parsing
 */
export function createTaskParser(): TaskParserService {
  return {
    /**
     * Parse tasks.md from specification directory
     * Requirements: 5.1 - Read and parse tasks.md
     */
    async parse(specDir: string): Promise<readonly Task[]> {
      const tasksPath = join(specDir, 'tasks.md');

      let content: string;
      try {
        content = await readFile(tasksPath, 'utf-8');
      } catch {
        // File doesn't exist or couldn't be read
        return [];
      }

      const lines = content.split('\n');
      const tasks: Task[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isTaskLine(line)) {
          const parsed = parseTaskLine(line);
          if (parsed) {
            const description = parseDescription(lines, i + 1);

            tasks.push({
              id: parsed.id,
              title: parsed.title,
              description,
              completed: parsed.completed,
              priority: parsed.priority,
              hasAsterisk: parsed.hasAsterisk
            });
          }
        }
      }

      return tasks;
    },

    /**
     * Filter to get only pending (uncompleted) tasks
     * Requirements: 5.1 - Track completion status
     */
    getPendingTasks(tasks: readonly Task[]): readonly Task[] {
      return tasks.filter(task => !task.completed);
    },

    /**
     * Find task by ID
     * Requirements: 5.1 - Access tasks by identifier
     */
    getTaskById(tasks: readonly Task[], id: string): Task | undefined {
      return tasks.find(task => task.id === id);
    },

    /**
     * Mark a task as complete in tasks.md
     * Orchestrator-controlled: updates checkbox from [ ] to [x]
     * Uses atomic write pattern (temp file + rename)
     *
     * Handles gracefully:
     * - Task already marked complete (returns success, no-op)
     * - Task not found (returns error)
     */
    async markTaskComplete(specDir: string, taskId: string): Promise<MarkTaskCompleteResult> {
      const tasksPath = join(specDir, 'tasks.md');

      let content: string;
      try {
        content = await readFile(tasksPath, 'utf-8');
      } catch {
        return { success: false, error: `Cannot read tasks.md at ${tasksPath}` };
      }

      const lines = content.split('\n');
      let found = false;
      let alreadyComplete = false;

      // Escape taskId for regex (handle dots in task IDs like "1.2")
      const escapedTaskId = taskId.replace('.', '\\.');

      // Find the task line - match both unchecked [ ] and checked [x]
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: - [ ] taskId or - [x] taskId (with optional asterisk after bracket)
        // Pattern: "- [" + space or x + "]" + optional asterisk + whitespace + task ID
        const taskFinderPattern = new RegExp(`^-\\s+\\[([x ]?)\\]\\*?\\s+${escapedTaskId}(?:\\.|\\s)`);
        const match = line.match(taskFinderPattern);

        if (match) {
          found = true;
          const checkmark = match[1];

          if (checkmark === 'x') {
            // Task already marked complete - success but no-op
            alreadyComplete = true;
            break;
          }

          // Task is unchecked - mark it complete
          // Replace [ ] with [x], preserving rest of line
          const updatePattern = new RegExp(`^(-\\s+\\[) (\\]\\*?\\s+${escapedTaskId}(?:\\.|\\s))`);
          lines[i] = line.replace(updatePattern, '$1x$2');
          break;
        }
      }

      if (!found) {
        return { success: false, error: `Task ${taskId} not found in tasks.md` };
      }

      // If already complete, return success without writing
      if (alreadyComplete) {
        return { success: true };
      }

      // Atomic write: temp file + rename
      const tempPath = join(specDir, `tasks.${randomBytes(8).toString('hex')}.tmp`);
      const newContent = lines.join('\n');

      try {
        await writeFile(tempPath, newContent, 'utf-8');
        await rename(tempPath, tasksPath);
        return { success: true };
      } catch (error) {
        // Clean up temp file on error
        try {
          await rm(tempPath, { force: true });
        } catch {
          // Ignore cleanup errors
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write tasks.md'
        };
      }
    },

    /**
     * Parse tasks into groups from tasks.md
     * Requirement: Group-level tracking for progress visibility
     */
    async parseGroups(specDir: string): Promise<readonly TaskGroup[]> {
      const tasks = await this.parse(specDir);
      return this.groupTasks(tasks);
    },

    /**
     * Group tasks by their group ID (first number before the dot)
     * Also extracts group titles from tasks.md headers
     */
    groupTasks(tasks: readonly Task[]): readonly TaskGroup[] {
      // Get unique group IDs
      const groupIds = [...new Set(
        tasks.map(t => getGroupIdFromTaskId(t.id))
      )].sort((a, b) => a - b);

      return groupIds.map(groupId => {
        const groupTasks = tasks.filter(t => getGroupIdFromTaskId(t.id) === groupId);
        const completedCount = groupTasks.filter(t => t.completed).length;

        // Use first task's title as fallback group title
        const groupTitle = groupTasks[0]?.title ?? `Group ${groupId}`;

        return {
          groupId,
          title: groupTitle,
          tasks: groupTasks,
          completed: completedCount === groupTasks.length && groupTasks.length > 0,
          taskCount: groupTasks.length,
          completedCount
        };
      });
    },

    /**
     * Check if a group is fully complete
     */
    isGroupComplete(tasks: readonly Task[], groupId: number): boolean {
      const groupTasks = this.getTasksInGroup(tasks, groupId);
      return groupTasks.length > 0 && groupTasks.every(t => t.completed);
    },

    /**
     * Get all tasks in a specific group
     */
    getTasksInGroup(tasks: readonly Task[], groupId: number): readonly Task[] {
      return tasks.filter(t => getGroupIdFromTaskId(t.id) === groupId);
    },

    /**
     * Get completed groups from a task list
     */
    getCompletedGroups(tasks: readonly Task[]): readonly number[] {
      const groups = this.groupTasks(tasks);
      return groups
        .filter(g => g.completed)
        .map(g => g.groupId);
    }
  };
}
