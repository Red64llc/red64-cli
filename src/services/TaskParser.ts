/**
 * Task Parser Service
 * Task 4.1: Create task parser to extract tasks from tasks.md
 * Requirements: 5.1
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
 * Task parser service interface
 * Requirements: 5.1
 */
export interface TaskParserService {
  parse(specDir: string): Promise<readonly Task[]>;
  getPendingTasks(tasks: readonly Task[]): readonly Task[];
  getTaskById(tasks: readonly Task[], id: string): Task | undefined;
}

/**
 * Task line pattern
 * Matches: - [ ] 1.1 Task title or - [x] 1.1 Task title
 * Also handles: - [ ]* 1.1 (P) Task title
 */
const TASK_LINE_PATTERN = /^-\s+\[([ x])\](\*)?\s+(\d+\.\d+)\s+(?:\(P\)\s+)?(.+)$/;

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
    }
  };
}
