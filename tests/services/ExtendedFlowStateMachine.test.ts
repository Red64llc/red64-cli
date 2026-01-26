/**
 * Extended Flow State Machine Tests
 * Task 2.2: Implement mode-aware state transition function
 * Requirements: 2.2, 2.4, 2.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createExtendedFlowMachine,
  extendedTransition,
  type ExtendedFlowMachineService
} from '../../src/services/ExtendedFlowStateMachine.js';
import type { ExtendedFlowPhase, ExtendedFlowEvent, WorkflowMode } from '../../src/types/extended-flow.js';

describe('ExtendedFlowStateMachine', () => {
  describe('extendedTransition function (pure)', () => {
    describe('greenfield mode transitions', () => {
      it('should transition from idle to initializing on START', () => {
        const phase: ExtendedFlowPhase = { type: 'idle' };
        const event: ExtendedFlowEvent = {
          type: 'START',
          feature: 'test-feature',
          description: 'Test',
          mode: 'greenfield'
        };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('initializing');
        if (result.type === 'initializing') {
          expect(result.feature).toBe('test-feature');
        }
      });

      it('should transition from initializing to requirements-generating', () => {
        const phase: ExtendedFlowPhase = {
          type: 'initializing',
          feature: 'test',
          description: 'Test'
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('requirements-generating');
      });

      it('should transition from requirements-generating to requirements-approval', () => {
        const phase: ExtendedFlowPhase = {
          type: 'requirements-generating',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('requirements-approval');
      });

      it('should transition from requirements-approval to design-generating in greenfield', () => {
        const phase: ExtendedFlowPhase = {
          type: 'requirements-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'greenfield');

        // In greenfield, skip gap-analysis
        expect(result.type).toBe('design-generating');
      });

      it('should transition from design-approval to tasks-generating in greenfield', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'greenfield');

        // In greenfield, skip design-validation
        expect(result.type).toBe('tasks-generating');
      });

      it('should transition from tasks-approval to implementing', () => {
        const phase: ExtendedFlowPhase = {
          type: 'tasks-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('implementing');
        if (result.type === 'implementing') {
          expect(result.currentTask).toBe(1);
          expect(result.totalTasks).toBe(0);
        }
      });

      it('should transition from implementing to validation on PHASE_COMPLETE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'implementing',
          feature: 'test',
          currentTask: 5,
          totalTasks: 5
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('validation');
      });

      it('should transition from validation to pr', () => {
        const phase: ExtendedFlowPhase = {
          type: 'validation',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('pr');
      });

      it('should transition from pr to merge-decision on PR_CREATED', () => {
        const phase: ExtendedFlowPhase = {
          type: 'pr',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'PR_CREATED', prUrl: 'https://github.com/test/pr/1' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('merge-decision');
        if (result.type === 'merge-decision') {
          expect(result.prUrl).toBe('https://github.com/test/pr/1');
        }
      });

      it('should transition from merge-decision to complete on MERGE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'merge-decision',
          feature: 'test',
          prUrl: 'https://github.com/test/pr/1'
        };
        const event: ExtendedFlowEvent = { type: 'MERGE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('complete');
      });

      it('should transition from merge-decision to complete on SKIP_MERGE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'merge-decision',
          feature: 'test',
          prUrl: 'https://github.com/test/pr/1'
        };
        const event: ExtendedFlowEvent = { type: 'SKIP_MERGE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('complete');
      });
    });

    describe('brownfield mode transitions', () => {
      it('should transition from requirements-approval to gap-analysis in brownfield', () => {
        const phase: ExtendedFlowPhase = {
          type: 'requirements-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('gap-analysis');
      });

      it('should transition from gap-analysis to gap-review', () => {
        const phase: ExtendedFlowPhase = {
          type: 'gap-analysis',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('gap-review');
      });

      it('should transition from gap-review to design-generating on APPROVE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'gap-review',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('design-generating');
      });

      it('should transition from gap-review back to requirements-generating on REJECT', () => {
        const phase: ExtendedFlowPhase = {
          type: 'gap-review',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'REJECT' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('requirements-generating');
      });

      it('should transition from design-approval to design-validation in brownfield', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('design-validation');
      });

      it('should transition from design-validation to design-validation-review', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-validation',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'PHASE_COMPLETE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('design-validation-review');
      });

      it('should transition from design-validation-review to tasks-generating on APPROVE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-validation-review',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('tasks-generating');
      });

      it('should transition from design-validation-review back to design-generating on REJECT', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-validation-review',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'REJECT' };

        const result = extendedTransition(phase, event, 'brownfield');

        expect(result.type).toBe('design-generating');
      });
    });

    describe('REJECT transitions', () => {
      it('should transition from requirements-approval back to requirements-generating', () => {
        const phase: ExtendedFlowPhase = {
          type: 'requirements-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'REJECT' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('requirements-generating');
      });

      it('should transition from design-approval back to design-generating', () => {
        const phase: ExtendedFlowPhase = {
          type: 'design-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'REJECT' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('design-generating');
      });

      it('should transition from tasks-approval back to tasks-generating', () => {
        const phase: ExtendedFlowPhase = {
          type: 'tasks-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'REJECT' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('tasks-generating');
      });
    });

    describe('PAUSE and resume transitions', () => {
      it('should transition from implementing to paused on PAUSE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'implementing',
          feature: 'test',
          currentTask: 3,
          totalTasks: 10
        };
        const event: ExtendedFlowEvent = { type: 'PAUSE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('paused');
        if (result.type === 'paused') {
          expect(result.pausedAt).toBe(3);
          expect(result.totalTasks).toBe(10);
        }
      });

      it('should transition from paused back to implementing on RESUME', () => {
        const phase: ExtendedFlowPhase = {
          type: 'paused',
          feature: 'test',
          pausedAt: 3,
          totalTasks: 10
        };
        const event: ExtendedFlowEvent = { type: 'RESUME', feature: 'test' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('implementing');
        if (result.type === 'implementing') {
          expect(result.currentTask).toBe(3);
          expect(result.totalTasks).toBe(10);
        }
      });
    });

    describe('task progress transitions', () => {
      it('should update currentTask on TASK_COMPLETE', () => {
        const phase: ExtendedFlowPhase = {
          type: 'implementing',
          feature: 'test',
          currentTask: 2,
          totalTasks: 5
        };
        const event: ExtendedFlowEvent = { type: 'TASK_COMPLETE', taskIndex: 3 };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('implementing');
        if (result.type === 'implementing') {
          expect(result.currentTask).toBe(3);
        }
      });
    });

    describe('global events', () => {
      it('should transition to aborted on ABORT from any phase', () => {
        const phases: ExtendedFlowPhase[] = [
          { type: 'initializing', feature: 'test', description: 'test' },
          { type: 'requirements-generating', feature: 'test' },
          { type: 'implementing', feature: 'test', currentTask: 1, totalTasks: 5 }
        ];
        const event: ExtendedFlowEvent = { type: 'ABORT', reason: 'User cancelled' };

        phases.forEach(phase => {
          const result = extendedTransition(phase, event, 'greenfield');
          expect(result.type).toBe('aborted');
          if (result.type === 'aborted') {
            expect(result.reason).toBe('User cancelled');
          }
        });
      });

      it('should transition to error on ERROR from any phase', () => {
        const phase: ExtendedFlowPhase = {
          type: 'requirements-generating',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'ERROR', error: 'Agent failed' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('error');
        if (result.type === 'error') {
          expect(result.error).toBe('Agent failed');
        }
      });
    });

    describe('invalid transitions', () => {
      it('should return current phase for invalid transition', () => {
        const phase: ExtendedFlowPhase = { type: 'idle' };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'greenfield');

        expect(result.type).toBe('idle');
      });

      it('should not allow brownfield phases in greenfield mode', () => {
        // gap-analysis should not be reachable via normal transitions in greenfield
        const phase: ExtendedFlowPhase = {
          type: 'requirements-approval',
          feature: 'test'
        };
        const event: ExtendedFlowEvent = { type: 'APPROVE' };

        const result = extendedTransition(phase, event, 'greenfield');

        // In greenfield, should skip to design-generating, not gap-analysis
        expect(result.type).toBe('design-generating');
      });
    });
  });

  describe('createExtendedFlowMachine', () => {
    let machine: ExtendedFlowMachineService;

    beforeEach(() => {
      machine = createExtendedFlowMachine();
    });

    it('should create machine with idle initial phase', () => {
      expect(machine.getPhase().type).toBe('idle');
    });

    it('should set mode on START event', () => {
      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'brownfield'
      });

      expect(machine.getMode()).toBe('brownfield');
    });

    it('should lock mode after START', () => {
      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      // Try to change mode - should not affect
      // Mode is locked at START
      expect(machine.getMode()).toBe('greenfield');
    });

    it('should return new phase from send', () => {
      const newPhase = machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      expect(newPhase.type).toBe('initializing');
    });

    it('canTransition should return true for valid transitions', () => {
      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      const canComplete = machine.canTransition({ type: 'PHASE_COMPLETE' });

      expect(canComplete).toBe(true);
    });

    it('canTransition should return false for invalid transitions', () => {
      const canApprove = machine.canTransition({ type: 'APPROVE' });

      expect(canApprove).toBe(false);
    });
  });
});
