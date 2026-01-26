import { describe, it, expect } from 'vitest';
import {
  createFlowMachine,
  transition,
  type FlowMachineService
} from '../../src/services/FlowStateMachine.js';
import type { FlowPhase, FlowEvent } from '../../src/types/index.js';

describe('FlowStateMachine', () => {
  describe('transition function (pure)', () => {
    it('should transition from idle to initializing on START event', () => {
      const phase: FlowPhase = { type: 'idle' };
      const event: FlowEvent = {
        type: 'START',
        feature: 'test-feature',
        description: 'Test description'
      };

      const result = transition(phase, event);

      expect(result.type).toBe('initializing');
      if (result.type === 'initializing') {
        expect(result.feature).toBe('test-feature');
        expect(result.description).toBe('Test description');
      }
    });

    it('should transition from initializing to requirements-generating on PHASE_COMPLETE', () => {
      const phase: FlowPhase = {
        type: 'initializing',
        feature: 'test-feature',
        description: 'Test'
      };
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };

      const result = transition(phase, event);

      expect(result.type).toBe('requirements-generating');
    });

    it('should transition from requirements-generating to requirements-review on PHASE_COMPLETE', () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };

      const result = transition(phase, event);

      expect(result.type).toBe('requirements-review');
    });

    it('should transition from requirements-review to design-generating on APPROVE', () => {
      const phase: FlowPhase = {
        type: 'requirements-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'APPROVE' };

      const result = transition(phase, event);

      expect(result.type).toBe('design-generating');
    });

    it('should transition from requirements-review back to requirements-generating on REJECT', () => {
      const phase: FlowPhase = {
        type: 'requirements-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'REJECT' };

      const result = transition(phase, event);

      expect(result.type).toBe('requirements-generating');
    });

    it('should transition from design-generating to design-review on PHASE_COMPLETE', () => {
      const phase: FlowPhase = {
        type: 'design-generating',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };

      const result = transition(phase, event);

      expect(result.type).toBe('design-review');
    });

    it('should transition from design-review to tasks-generating on APPROVE', () => {
      const phase: FlowPhase = {
        type: 'design-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'APPROVE' };

      const result = transition(phase, event);

      expect(result.type).toBe('tasks-generating');
    });

    it('should transition from design-review back to design-generating on REJECT', () => {
      const phase: FlowPhase = {
        type: 'design-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'REJECT' };

      const result = transition(phase, event);

      expect(result.type).toBe('design-generating');
    });

    it('should transition from tasks-generating to tasks-review on PHASE_COMPLETE', () => {
      const phase: FlowPhase = {
        type: 'tasks-generating',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };

      const result = transition(phase, event);

      expect(result.type).toBe('tasks-review');
    });

    it('should transition from tasks-review to implementing on APPROVE', () => {
      const phase: FlowPhase = {
        type: 'tasks-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'APPROVE' };

      const result = transition(phase, event);

      expect(result.type).toBe('implementing');
      if (result.type === 'implementing') {
        expect(result.currentTask).toBe(1);
        expect(result.totalTasks).toBe(0); // Placeholder until tasks are counted
      }
    });

    it('should transition from tasks-review back to tasks-generating on REJECT', () => {
      const phase: FlowPhase = {
        type: 'tasks-review',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'REJECT' };

      const result = transition(phase, event);

      expect(result.type).toBe('tasks-generating');
    });

    it('should transition from implementing to complete on PHASE_COMPLETE', () => {
      const phase: FlowPhase = {
        type: 'implementing',
        feature: 'test-feature',
        currentTask: 5,
        totalTasks: 5
      };
      const event: FlowEvent = { type: 'PHASE_COMPLETE' };

      const result = transition(phase, event);

      expect(result.type).toBe('complete');
    });

    it('should transition to aborted on ABORT event from any phase', () => {
      const phases: FlowPhase[] = [
        { type: 'idle' },
        { type: 'initializing', feature: 'test', description: 'test' },
        { type: 'requirements-generating', feature: 'test' },
        { type: 'requirements-review', feature: 'test' },
        { type: 'implementing', feature: 'test', currentTask: 1, totalTasks: 5 }
      ];

      const event: FlowEvent = { type: 'ABORT', reason: 'User cancelled' };

      phases.forEach(phase => {
        const result = transition(phase, event);
        expect(result.type).toBe('aborted');
        if (result.type === 'aborted') {
          expect(result.reason).toBe('User cancelled');
        }
      });
    });

    it('should transition to error on ERROR event from any phase', () => {
      const phase: FlowPhase = {
        type: 'requirements-generating',
        feature: 'test-feature'
      };
      const event: FlowEvent = { type: 'ERROR', error: 'Agent failed' };

      const result = transition(phase, event);

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.error).toBe('Agent failed');
      }
    });

    it('should return current phase for invalid transitions', () => {
      const phase: FlowPhase = { type: 'idle' };
      const event: FlowEvent = { type: 'APPROVE' }; // Invalid for idle

      const result = transition(phase, event);

      expect(result.type).toBe('idle'); // Should remain in idle
    });

    it('should handle RESUME event from idle', () => {
      const phase: FlowPhase = { type: 'idle' };
      const event: FlowEvent = { type: 'RESUME', feature: 'test-feature' };

      // RESUME should be handled specially - typically loads from persisted state
      // For now, it stays in idle (actual resume logic in StateStore)
      const result = transition(phase, event);
      expect(result).toBeTruthy();
    });
  });

  describe('createFlowMachine', () => {
    it('should create machine with idle initial phase by default', () => {
      const machine = createFlowMachine();

      expect(machine.getPhase().type).toBe('idle');
    });

    it('should create machine with custom initial phase', () => {
      const initialPhase: FlowPhase = {
        type: 'requirements-review',
        feature: 'test-feature'
      };
      const machine = createFlowMachine(initialPhase);

      expect(machine.getPhase().type).toBe('requirements-review');
    });

    it('should update phase on send', () => {
      const machine = createFlowMachine();

      machine.send({
        type: 'START',
        feature: 'test-feature',
        description: 'Test'
      });

      expect(machine.getPhase().type).toBe('initializing');
    });

    it('should return new phase from send', () => {
      const machine = createFlowMachine();

      const newPhase = machine.send({
        type: 'START',
        feature: 'test-feature',
        description: 'Test'
      });

      expect(newPhase.type).toBe('initializing');
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      const machine = createFlowMachine();

      const canStart = machine.canTransition({
        type: 'START',
        feature: 'test',
        description: 'test'
      });

      expect(canStart).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      const machine = createFlowMachine();

      const canApprove = machine.canTransition({ type: 'APPROVE' });

      expect(canApprove).toBe(false);
    });

    it('should return true for ABORT from any phase', () => {
      const machine = createFlowMachine({
        type: 'requirements-generating',
        feature: 'test'
      });

      const canAbort = machine.canTransition({
        type: 'ABORT',
        reason: 'User cancelled'
      });

      expect(canAbort).toBe(true);
    });

    it('should return true for ERROR from any phase', () => {
      const machine = createFlowMachine({
        type: 'design-review',
        feature: 'test'
      });

      const canError = machine.canTransition({
        type: 'ERROR',
        error: 'Something went wrong'
      });

      expect(canError).toBe(true);
    });
  });
});
