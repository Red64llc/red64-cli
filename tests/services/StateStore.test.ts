import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createStateStore,
  createTaskEntry,
  getInProgressTask,
  getNextPendingTask,
  getFirstFailedTask,
  getResumeTask,
  markTaskStarted,
  markTaskFailed,
  type StateStoreService
} from '../../src/services/StateStore.js';
import type { FlowState, FlowPhase, TaskEntry } from '../../src/types/index.js';

describe('StateStore', () => {
  let tempDir: string;
  let stateStore: StateStoreService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-test-'));
    stateStore = createStateStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createTestState = (feature: string, phase: FlowPhase): FlowState => ({
    feature,
    phase,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    metadata: {
      description: `Test feature ${feature}`,
      mode: 'greenfield'
    }
  });

  describe('save and load', () => {
    it('should save flow state', async () => {
      const state = createTestState('test-feature', { type: 'idle' });

      await stateStore.save(state);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should load saved flow state', async () => {
      const state = createTestState('test-feature', {
        type: 'requirements-approval',
        feature: 'test-feature'
      });

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded).toBeDefined();
      expect(loaded?.feature).toBe('test-feature');
      expect(loaded?.phase.type).toBe('requirements-approval');
    });

    it('should return undefined for non-existent feature', async () => {
      const loaded = await stateStore.load('non-existent');

      expect(loaded).toBeUndefined();
    });

    it('should preserve timestamps', async () => {
      const state = createTestState('test-feature', { type: 'idle' });

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded?.createdAt).toBe(state.createdAt);
      expect(loaded?.updatedAt).toBe(state.updatedAt);
    });

    it('should preserve metadata', async () => {
      const state: FlowState = {
        ...createTestState('test-feature', { type: 'idle' }),
        metadata: {
          description: 'Custom description',
          mode: 'brownfield',
          tier: 'premium'
        }
      };

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded?.metadata.description).toBe('Custom description');
      expect(loaded?.metadata.mode).toBe('brownfield');
      expect(loaded?.metadata.tier).toBe('premium');
    });

    it('should preserve history', async () => {
      // Use new HistoryEntry format
      const state: FlowState = {
        ...createTestState('test-feature', {
          type: 'requirements-approval',
          feature: 'test-feature'
        }),
        history: [
          { phase: { type: 'idle' }, timestamp: new Date().toISOString() },
          { phase: { type: 'initializing', feature: 'test-feature', description: 'test' }, timestamp: new Date().toISOString() }
        ]
      };

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded?.history).toHaveLength(2);
      expect(loaded?.history[0].phase.type).toBe('idle');
    });

    it('should update existing state', async () => {
      const state1 = createTestState('test-feature', { type: 'idle' });
      await stateStore.save(state1);

      const state2 = createTestState('test-feature', {
        type: 'requirements-generating',
        feature: 'test-feature'
      });
      await stateStore.save(state2);

      const loaded = await stateStore.load('test-feature');
      expect(loaded?.phase.type).toBe('requirements-generating');
    });
  });

  describe('exists', () => {
    it('should return true for existing feature', async () => {
      const state = createTestState('test-feature', { type: 'idle' });
      await stateStore.save(state);

      const exists = await stateStore.exists('test-feature');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent feature', async () => {
      const exists = await stateStore.exists('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing flow state', async () => {
      const state = createTestState('test-feature', { type: 'idle' });
      await stateStore.save(state);

      await stateStore.delete('test-feature');

      const exists = await stateStore.exists('test-feature');
      expect(exists).toBe(false);
    });

    it('should not throw when deleting non-existent feature', async () => {
      await expect(stateStore.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array when no flows exist', async () => {
      const flows = await stateStore.list();

      expect(flows).toEqual([]);
    });

    it('should return all saved flows', async () => {
      const state1 = createTestState('feature-1', { type: 'idle' });
      const state2 = createTestState('feature-2', {
        type: 'requirements-approval',
        feature: 'feature-2'
      });

      await stateStore.save(state1);
      await stateStore.save(state2);

      const flows = await stateStore.list();

      expect(flows).toHaveLength(2);
      expect(flows.map(f => f.feature).sort()).toEqual(['feature-1', 'feature-2']);
    });

    it('should not include deleted flows', async () => {
      const state1 = createTestState('feature-1', { type: 'idle' });
      const state2 = createTestState('feature-2', { type: 'idle' });

      await stateStore.save(state1);
      await stateStore.save(state2);
      await stateStore.delete('feature-1');

      const flows = await stateStore.list();

      expect(flows).toHaveLength(1);
      expect(flows[0].feature).toBe('feature-2');
    });
  });

  describe('path structure', () => {
    it('should use .red64/flows directory structure', async () => {
      // Store uses baseDir/.red64/flows/{feature}/state.json
      // This is validated by successful save/load operations
      const state = createTestState('test-feature', { type: 'idle' });

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should handle corrupted state files gracefully', async () => {
      // Create a corrupted state file
      const { writeFile, mkdir } = await import('node:fs/promises');
      const flowDir = join(tempDir, '.red64', 'flows', 'corrupted-feature');
      await mkdir(flowDir, { recursive: true });
      await writeFile(join(flowDir, 'state.json'), 'not valid json');

      const loaded = await stateStore.load('corrupted-feature');

      expect(loaded).toBeUndefined();
    });
  });

  describe('archive', () => {
    it('should archive flow state by renaming state file', async () => {
      const { access } = await import('node:fs/promises');
      const state = createTestState('test-feature', { type: 'idle' });
      await stateStore.save(state);

      await stateStore.archive('test-feature');

      // Original state.json should no longer exist
      const exists = await stateStore.exists('test-feature');
      expect(exists).toBe(false);

      // state.archived.json should exist
      const archivePath = join(tempDir, '.red64', 'flows', 'test-feature', 'state.archived.json');
      await expect(access(archivePath)).resolves.not.toThrow();
    });

    it('should not throw when archiving non-existent feature', async () => {
      await expect(stateStore.archive('non-existent')).resolves.not.toThrow();
    });

    it('should not include archived flows in list', async () => {
      const state1 = createTestState('feature-1', { type: 'idle' });
      const state2 = createTestState('feature-2', { type: 'idle' });

      await stateStore.save(state1);
      await stateStore.save(state2);
      await stateStore.archive('feature-1');

      const flows = await stateStore.list();

      expect(flows).toHaveLength(1);
      expect(flows[0].feature).toBe('feature-2');
    });

    it('should preserve archived state content', async () => {
      const { readFile } = await import('node:fs/promises');
      const state = createTestState('test-feature', {
        type: 'requirements-approval',
        feature: 'test-feature'
      });
      await stateStore.save(state);

      await stateStore.archive('test-feature');

      const archivePath = join(tempDir, '.red64', 'flows', 'test-feature', 'state.archived.json');
      const content = await readFile(archivePath, 'utf-8');
      const archived = JSON.parse(content);

      expect(archived.feature).toBe('test-feature');
      expect(archived.phase.type).toBe('requirements-approval');
    });
  });
});

describe('Task Entry Helpers', () => {
  describe('getFirstFailedTask', () => {
    it('should return undefined for empty entries', () => {
      const result = getFirstFailedTask([]);
      expect(result).toBeUndefined();
    });

    it('should return undefined when no failed tasks exist', () => {
      const entries: TaskEntry[] = [
        createTaskEntry('1', 'Task 1'),
        { ...createTaskEntry('2', 'Task 2'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('3', 'Task 3'), status: 'in_progress', startedAt: new Date().toISOString() }
      ];
      const result = getFirstFailedTask(entries);
      expect(result).toBeUndefined();
    });

    it('should return the first failed task', () => {
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2', 'Task 2'), status: 'failed' },
        { ...createTaskEntry('3', 'Task 3'), status: 'failed' }
      ];
      const result = getFirstFailedTask(entries);
      expect(result?.id).toBe('2');
    });
  });

  describe('getResumeTask', () => {
    it('should return undefined for empty entries', () => {
      const result = getResumeTask([]);
      expect(result).toBeUndefined();
    });

    it('should return in_progress task first (highest priority)', () => {
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'failed' },
        { ...createTaskEntry('2', 'Task 2'), status: 'in_progress', startedAt: new Date().toISOString() },
        createTaskEntry('3', 'Task 3') // pending
      ];
      const result = getResumeTask(entries);
      expect(result?.id).toBe('2');
    });

    it('should return failed task when no in_progress task exists', () => {
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2', 'Task 2'), status: 'failed' },
        createTaskEntry('3', 'Task 3') // pending
      ];
      const result = getResumeTask(entries);
      expect(result?.id).toBe('2');
    });

    it('should return pending task when no in_progress or failed tasks exist', () => {
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2', 'Task 2'), status: 'completed', completedAt: new Date().toISOString() },
        createTaskEntry('3', 'Task 3') // pending
      ];
      const result = getResumeTask(entries);
      expect(result?.id).toBe('3');
    });

    it('should return undefined when all tasks are completed', () => {
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2', 'Task 2'), status: 'completed', completedAt: new Date().toISOString() }
      ];
      const result = getResumeTask(entries);
      expect(result).toBeUndefined();
    });

    it('should handle Docker error scenario - many failed tasks should be resumed', () => {
      // Simulate the bug scenario: 5 completed, rest failed due to Docker error
      const entries: TaskEntry[] = [
        { ...createTaskEntry('1', 'Task 1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2', 'Task 2'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2.1', 'Task 2.1'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2.2', 'Task 2.2'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('2.3', 'Task 2.3'), status: 'completed', completedAt: new Date().toISOString() },
        { ...createTaskEntry('3', 'Task 3'), status: 'failed' }, // First failed due to Docker
        { ...createTaskEntry('3.1', 'Task 3.1'), status: 'failed' },
        { ...createTaskEntry('3.2', 'Task 3.2'), status: 'failed' },
        { ...createTaskEntry('4', 'Task 4'), status: 'failed' }
      ];

      const result = getResumeTask(entries);

      // Should resume from first failed task, not return undefined!
      expect(result).toBeDefined();
      expect(result?.id).toBe('3');
      expect(result?.status).toBe('failed');
    });
  });
});
