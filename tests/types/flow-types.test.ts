import { describe, it, expect, assertType } from 'vitest';
import type {
  FlowPhase,
  FlowEvent,
  FlowState,
  Status
} from '../../src/types/index.js';

describe('Flow Type System', () => {
  describe('FlowPhase', () => {
    it('should accept idle phase', () => {
      const phase: FlowPhase = { type: 'idle' };
      expect(phase.type).toBe('idle');
    });

    it('should accept initializing phase with feature and description', () => {
      const phase: FlowPhase = {
        type: 'initializing',
        feature: 'test-feature',
        description: 'Test description'
      };
      expect(phase.type).toBe('initializing');
      expect(phase.feature).toBe('test-feature');
    });

    it('should accept requirements-generating phase', () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('requirements-generating');
    });

    it('should accept requirements-review phase', () => {
      const phase: FlowPhase = {
        type: 'requirements-review',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('requirements-review');
    });

    it('should accept design-generating phase', () => {
      const phase: FlowPhase = {
        type: 'design-generating',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('design-generating');
    });

    it('should accept design-review phase', () => {
      const phase: FlowPhase = {
        type: 'design-review',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('design-review');
    });

    it('should accept tasks-generating phase', () => {
      const phase: FlowPhase = {
        type: 'tasks-generating',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('tasks-generating');
    });

    it('should accept tasks-review phase', () => {
      const phase: FlowPhase = {
        type: 'tasks-review',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('tasks-review');
    });

    it('should accept implementing phase with task counts', () => {
      const phase: FlowPhase = {
        type: 'implementing',
        feature: 'test-feature',
        currentTask: 1,
        totalTasks: 5
      };
      expect(phase.type).toBe('implementing');
      expect(phase.currentTask).toBe(1);
      expect(phase.totalTasks).toBe(5);
    });

    it('should accept complete phase', () => {
      const phase: FlowPhase = {
        type: 'complete',
        feature: 'test-feature'
      };
      expect(phase.type).toBe('complete');
    });

    it('should accept aborted phase with reason', () => {
      const phase: FlowPhase = {
        type: 'aborted',
        feature: 'test-feature',
        reason: 'User cancelled'
      };
      expect(phase.type).toBe('aborted');
      expect(phase.reason).toBe('User cancelled');
    });

    it('should accept error phase', () => {
      const phase: FlowPhase = {
        type: 'error',
        feature: 'test-feature',
        error: 'Something went wrong'
      };
      expect(phase.type).toBe('error');
      expect(phase.error).toBe('Something went wrong');
    });
  });

  describe('FlowEvent', () => {
    it('should accept START event', () => {
      const event: FlowEvent = {
        type: 'START',
        feature: 'test-feature',
        description: 'Test description'
      };
      expect(event.type).toBe('START');
    });

    it('should accept RESUME event', () => {
      const event: FlowEvent = {
        type: 'RESUME',
        feature: 'test-feature'
      };
      expect(event.type).toBe('RESUME');
    });

    it('should accept PHASE_COMPLETE event', () => {
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };
      expect(event.type).toBe('PHASE_COMPLETE');
    });

    it('should accept APPROVE event', () => {
      const event: FlowEvent = { type: 'APPROVE' };
      expect(event.type).toBe('APPROVE');
    });

    it('should accept REJECT event', () => {
      const event: FlowEvent = { type: 'REJECT' };
      expect(event.type).toBe('REJECT');
    });

    it('should accept ABORT event with reason', () => {
      const event: FlowEvent = {
        type: 'ABORT',
        reason: 'User cancelled'
      };
      expect(event.type).toBe('ABORT');
      expect(event.reason).toBe('User cancelled');
    });

    it('should accept ERROR event', () => {
      const event: FlowEvent = {
        type: 'ERROR',
        error: 'Something went wrong'
      };
      expect(event.type).toBe('ERROR');
      expect(event.error).toBe('Something went wrong');
    });
  });

  describe('FlowState', () => {
    it('should have all required fields', () => {
      const state: FlowState = {
        feature: 'test-feature',
        phase: { type: 'idle' },
        createdAt: '2026-01-25T00:00:00Z',
        updatedAt: '2026-01-25T00:00:00Z',
        history: [],
        metadata: {
          description: 'Test description',
          mode: 'greenfield'
        }
      };

      expect(state.feature).toBe('test-feature');
      expect(state.phase.type).toBe('idle');
      expect(state.createdAt).toBeTruthy();
      expect(state.updatedAt).toBeTruthy();
      expect(Array.isArray(state.history)).toBe(true);
      expect(state.metadata.mode).toBe('greenfield');
    });

    it('should support optional tier in metadata', () => {
      const state: FlowState = {
        feature: 'test-feature',
        phase: { type: 'idle' },
        createdAt: '2026-01-25T00:00:00Z',
        updatedAt: '2026-01-25T00:00:00Z',
        history: [],
        metadata: {
          description: 'Test description',
          mode: 'brownfield',
          tier: 'custom-tier'
        }
      };

      expect(state.metadata.tier).toBe('custom-tier');
    });
  });

  describe('Status', () => {
    it('should accept all valid status values', () => {
      const statuses: Status[] = ['pending', 'running', 'success', 'error', 'warning'];

      statuses.forEach(status => {
        const s: Status = status;
        expect(['pending', 'running', 'success', 'error', 'warning']).toContain(s);
      });
    });
  });
});
