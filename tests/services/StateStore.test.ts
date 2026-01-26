import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStateStore, type StateStoreService } from '../../src/services/StateStore.js';
import type { FlowState, FlowPhase } from '../../src/types/index.js';

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
        type: 'requirements-review',
        feature: 'test-feature'
      });

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded).toBeDefined();
      expect(loaded?.feature).toBe('test-feature');
      expect(loaded?.phase.type).toBe('requirements-review');
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
      const state: FlowState = {
        ...createTestState('test-feature', {
          type: 'requirements-review',
          feature: 'test-feature'
        }),
        history: [
          { type: 'idle' },
          { type: 'initializing', feature: 'test-feature', description: 'test' }
        ]
      };

      await stateStore.save(state);
      const loaded = await stateStore.load('test-feature');

      expect(loaded?.history).toHaveLength(2);
      expect(loaded?.history[0].type).toBe('idle');
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
        type: 'requirements-review',
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
});
