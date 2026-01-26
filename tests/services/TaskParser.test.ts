/**
 * Task Parser Tests
 * Task 4.1: Create task parser to extract tasks from tasks.md
 * Requirements: 5.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  createTaskParser,
  type TaskParserService,
  type Task
} from '../../src/services/TaskParser.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}));

const mockReadFile = readFile as ReturnType<typeof vi.fn>;

describe('TaskParser', () => {
  let parser: TaskParserService;

  beforeEach(() => {
    parser = createTaskParser();
    vi.clearAllMocks();
  });

  describe('parse', () => {
    it('should parse tasks from standard tasks.md format', async () => {
      const tasksContent = `# Implementation Plan

## Tasks

- [ ] 1. First main task
- [ ] 1.1 Subtask one
  - Description of subtask one
  - _Requirements: 1.1_

- [ ] 1.2 Subtask two
  - Description of subtask two
  - _Requirements: 1.2_

- [ ] 2. Second main task
- [ ] 2.1 Another subtask
  - Description here
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should extract task ID, title, and description', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 Create feature validator
  - Validate feature name format
  - Return error with examples
  - _Requirements: 1.1, 1.2_
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1.1');
      expect(tasks[0].title).toBe('Create feature validator');
      expect(tasks[0].description).toContain('Validate feature name format');
      expect(tasks[0].completed).toBe(false);
    });

    it('should detect completed tasks from checkbox markers', async () => {
      const tasksContent = `# Tasks

- [x] 1.1 Completed task
  - This task is done

- [ ] 1.2 Pending task
  - This task is not done
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].completed).toBe(true);
      expect(tasks[1].completed).toBe(false);
    });

    it('should maintain original task order', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 First task
- [ ] 1.2 Second task
- [ ] 2.1 Third task
- [ ] 3.1 Fourth task
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(4);
      expect(tasks[0].id).toBe('1.1');
      expect(tasks[1].id).toBe('1.2');
      expect(tasks[2].id).toBe('2.1');
      expect(tasks[3].id).toBe('3.1');
    });

    it('should handle tasks with (P) priority marker', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 (P) Priority task with marker
  - High priority description
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Priority task with marker');
      expect(tasks[0].priority).toBe(true);
    });

    it('should return empty array for missing tasks.md', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const tasks = await parser.parse('/spec');

      expect(tasks).toEqual([]);
    });

    it('should return empty array for tasks.md with no tasks', async () => {
      const tasksContent = `# Implementation Plan

## Overview

This is a document with no actual tasks.
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toEqual([]);
    });

    it('should handle multi-line task descriptions', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 Complex task
  - First line of description
  - Second line of description
  - Third line of description
  - _Requirements: 1.1_
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toContain('First line');
      expect(tasks[0].description).toContain('Second line');
    });

    it('should skip main task headers (tasks without subtask number)', async () => {
      const tasksContent = `# Tasks

- [ ] 1. Main task header (not executable)
- [ ] 1.1 Actual subtask to execute
  - Description
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      // Should only include subtasks (1.1), not main headers (1.)
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1.1');
    });

    it('should read tasks.md from correct path', async () => {
      mockReadFile.mockResolvedValue('# Tasks\n');

      await parser.parse('/my/spec/dir');

      expect(mockReadFile).toHaveBeenCalledWith('/my/spec/dir/tasks.md', 'utf-8');
    });

    it('should handle tasks with asterisk marker', async () => {
      const tasksContent = `# Tasks

- [ ]* 1.1 Task with asterisk
  - Description
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const tasks = await parser.parse('/spec');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1.1');
      expect(tasks[0].hasAsterisk).toBe(true);
    });
  });

  describe('getPendingTasks', () => {
    it('should return only uncompleted tasks', async () => {
      const tasksContent = `# Tasks

- [x] 1.1 Completed
- [ ] 1.2 Pending one
- [x] 2.1 Also completed
- [ ] 2.2 Pending two
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const allTasks = await parser.parse('/spec');
      const pending = parser.getPendingTasks(allTasks);

      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('1.2');
      expect(pending[1].id).toBe('2.2');
    });
  });

  describe('getTaskById', () => {
    it('should find task by ID', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 First
- [ ] 1.2 Second
- [ ] 2.1 Third
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const allTasks = await parser.parse('/spec');
      const task = parser.getTaskById(allTasks, '1.2');

      expect(task).toBeDefined();
      expect(task?.title).toBe('Second');
    });

    it('should return undefined for non-existent task', async () => {
      const tasksContent = `# Tasks

- [ ] 1.1 First
`;
      mockReadFile.mockResolvedValue(tasksContent);

      const allTasks = await parser.parse('/spec');
      const task = parser.getTaskById(allTasks, '9.9');

      expect(task).toBeUndefined();
    });
  });
});
