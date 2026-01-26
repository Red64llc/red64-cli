/**
 * Extended Flow Types Tests
 * Task 2.1: Define extended flow phase types and events
 * Requirements: 2.1, 2.5
 */

import { describe, it, expect } from 'vitest';
import type {
  ExtendedFlowPhase,
  ExtendedFlowEvent,
  WorkflowMode
} from '../../src/types/extended-flow.js';
import {
  GREENFIELD_PHASES,
  BROWNFIELD_PHASES,
  isApprovalPhase,
  isGeneratingPhase,
  isTerminalPhase
} from '../../src/types/extended-flow.js';

describe('Extended Flow Types', () => {
  describe('FlowPhase union', () => {
    it('should include all greenfield phases', () => {
      // Type check - these should compile without error
      const phases: ExtendedFlowPhase[] = [
        { type: 'idle' },
        { type: 'initializing', feature: 'test', description: 'test' },
        { type: 'requirements-generating', feature: 'test' },
        { type: 'requirements-approval', feature: 'test' },
        { type: 'design-generating', feature: 'test' },
        { type: 'design-approval', feature: 'test' },
        { type: 'tasks-generating', feature: 'test' },
        { type: 'tasks-approval', feature: 'test' },
        { type: 'implementing', feature: 'test', currentTask: 1, totalTasks: 5 },
        { type: 'validation', feature: 'test' },
        { type: 'pr', feature: 'test' },
        { type: 'merge-decision', feature: 'test', prUrl: 'https://github.com/test/pr/1' },
        { type: 'complete', feature: 'test' }
      ];

      expect(phases).toHaveLength(13);
    });

    it('should include brownfield-specific phases', () => {
      const brownfieldPhases: ExtendedFlowPhase[] = [
        { type: 'gap-analysis', feature: 'test' },
        { type: 'gap-review', feature: 'test' },
        { type: 'design-validation', feature: 'test' },
        { type: 'design-validation-review', feature: 'test' }
      ];

      expect(brownfieldPhases).toHaveLength(4);
    });

    it('should include paused phase with resume point', () => {
      const paused: ExtendedFlowPhase = {
        type: 'paused',
        feature: 'test',
        pausedAt: 3,
        totalTasks: 10
      };

      expect(paused.pausedAt).toBe(3);
      expect(paused.totalTasks).toBe(10);
    });

    it('should include error and aborted phases', () => {
      const error: ExtendedFlowPhase = { type: 'error', feature: 'test', error: 'Failed' };
      const aborted: ExtendedFlowPhase = { type: 'aborted', feature: 'test', reason: 'Cancelled' };

      expect(error.error).toBe('Failed');
      expect(aborted.reason).toBe('Cancelled');
    });
  });

  describe('FlowEvent union', () => {
    it('should include START event with mode', () => {
      const event: ExtendedFlowEvent = {
        type: 'START',
        feature: 'test-feature',
        description: 'Test description',
        mode: 'greenfield'
      };

      expect(event.mode).toBe('greenfield');
    });

    it('should include task-related events', () => {
      const taskComplete: ExtendedFlowEvent = {
        type: 'TASK_COMPLETE',
        taskIndex: 5
      };

      expect(taskComplete.taskIndex).toBe(5);
    });

    it('should include PR-related events', () => {
      const prCreated: ExtendedFlowEvent = {
        type: 'PR_CREATED',
        prUrl: 'https://github.com/test/pr/1'
      };
      const merge: ExtendedFlowEvent = { type: 'MERGE' };
      const skipMerge: ExtendedFlowEvent = { type: 'SKIP_MERGE' };

      expect(prCreated.prUrl).toBeDefined();
      expect(merge.type).toBe('MERGE');
      expect(skipMerge.type).toBe('SKIP_MERGE');
    });

    it('should include PAUSE event', () => {
      const pause: ExtendedFlowEvent = { type: 'PAUSE' };
      expect(pause.type).toBe('PAUSE');
    });

    it('should include PHASE_COMPLETE_WITH_DATA event', () => {
      const event: ExtendedFlowEvent = {
        type: 'PHASE_COMPLETE_WITH_DATA',
        data: { taskCount: 10 }
      };

      expect(event.data).toEqual({ taskCount: 10 });
    });
  });

  describe('WorkflowMode type', () => {
    it('should only allow greenfield or brownfield', () => {
      const greenfield: WorkflowMode = 'greenfield';
      const brownfield: WorkflowMode = 'brownfield';

      expect(greenfield).toBe('greenfield');
      expect(brownfield).toBe('brownfield');
    });
  });

  describe('GREENFIELD_PHASES constant', () => {
    it('should define correct phase sequence', () => {
      expect(GREENFIELD_PHASES).toEqual([
        'initializing',
        'requirements-generating',
        'requirements-approval',
        'design-generating',
        'design-approval',
        'tasks-generating',
        'tasks-approval',
        'implementing',
        'validation',
        'pr',
        'merge-decision',
        'complete'
      ]);
    });

    it('should not include brownfield-specific phases', () => {
      expect(GREENFIELD_PHASES).not.toContain('gap-analysis');
      expect(GREENFIELD_PHASES).not.toContain('gap-review');
      expect(GREENFIELD_PHASES).not.toContain('design-validation');
      expect(GREENFIELD_PHASES).not.toContain('design-validation-review');
    });
  });

  describe('BROWNFIELD_PHASES constant', () => {
    it('should define correct phase sequence with validation phases', () => {
      expect(BROWNFIELD_PHASES).toEqual([
        'initializing',
        'requirements-generating',
        'requirements-approval',
        'gap-analysis',
        'gap-review',
        'design-generating',
        'design-approval',
        'design-validation',
        'design-validation-review',
        'tasks-generating',
        'tasks-approval',
        'implementing',
        'validation',
        'pr',
        'merge-decision',
        'complete'
      ]);
    });

    it('should include gap-analysis after requirements-approval', () => {
      const reqApprovalIndex = BROWNFIELD_PHASES.indexOf('requirements-approval');
      const gapAnalysisIndex = BROWNFIELD_PHASES.indexOf('gap-analysis');

      expect(gapAnalysisIndex).toBe(reqApprovalIndex + 1);
    });

    it('should include design-validation after design-approval', () => {
      const designApprovalIndex = BROWNFIELD_PHASES.indexOf('design-approval');
      const designValidationIndex = BROWNFIELD_PHASES.indexOf('design-validation');

      expect(designValidationIndex).toBe(designApprovalIndex + 1);
    });
  });

  describe('helper functions', () => {
    it('isApprovalPhase should identify approval phases', () => {
      expect(isApprovalPhase('requirements-approval')).toBe(true);
      expect(isApprovalPhase('design-approval')).toBe(true);
      expect(isApprovalPhase('tasks-approval')).toBe(true);
      expect(isApprovalPhase('gap-review')).toBe(true);
      expect(isApprovalPhase('design-validation-review')).toBe(true);
      expect(isApprovalPhase('implementing')).toBe(false);
      expect(isApprovalPhase('idle')).toBe(false);
    });

    it('isGeneratingPhase should identify generating phases', () => {
      expect(isGeneratingPhase('requirements-generating')).toBe(true);
      expect(isGeneratingPhase('design-generating')).toBe(true);
      expect(isGeneratingPhase('tasks-generating')).toBe(true);
      expect(isGeneratingPhase('gap-analysis')).toBe(true);
      expect(isGeneratingPhase('design-validation')).toBe(true);
      expect(isGeneratingPhase('implementing')).toBe(true); // implementing is an executing phase
      expect(isGeneratingPhase('idle')).toBe(false);
      expect(isGeneratingPhase('requirements-approval')).toBe(false);
    });

    it('isTerminalPhase should identify terminal phases', () => {
      expect(isTerminalPhase('complete')).toBe(true);
      expect(isTerminalPhase('aborted')).toBe(true);
      expect(isTerminalPhase('error')).toBe(true);
      expect(isTerminalPhase('implementing')).toBe(false);
      expect(isTerminalPhase('idle')).toBe(false);
    });
  });
});
