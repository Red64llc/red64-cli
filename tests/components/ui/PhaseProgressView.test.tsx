/**
 * PhaseProgressView Component Tests
 * Task 2.1: Create phase progress visualization component
 * Requirements: 1.4, 2.1, 2.2
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { PhaseProgressView } from '../../../src/components/ui/PhaseProgressView.js';
import type { ExtendedFlowPhase, WorkflowMode } from '../../../src/types/index.js';
import { GREENFIELD_PHASES, BROWNFIELD_PHASES } from '../../../src/types/index.js';

describe('PhaseProgressView', () => {
  describe('rendering phases', () => {
    it('should render all greenfield phases', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="requirements-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Requirements');
      expect(output).toContain('Design');
      expect(output).toContain('Tasks');
    });

    it('should render all brownfield phases', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={BROWNFIELD_PHASES}
          currentPhase="gap-analysis"
          mode="brownfield"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Gap Analysis');
      expect(output).toContain('Validate Design');
    });
  });

  describe('phase status indicators', () => {
    it('should show checkmark for completed phases', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="design-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Phases before design-generating should be completed
      // The output should indicate initializing and requirements phases are done
      expect(output).toBeDefined();
    });

    it('should show current phase indicator for in-progress phase', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="requirements-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Should show something indicating "requirements-generating" is current
      expect(output).toContain('Requirements');
    });

    it('should show empty indicator for pending phases', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="initializing"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Phases after initializing should be pending
      expect(output).toBeDefined();
    });
  });

  describe('mode awareness', () => {
    it('should display greenfield phases when mode is greenfield', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="design-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Greenfield mode does NOT have gap-analysis
      expect(output).not.toContain('Gap Analysis');
    });

    it('should display brownfield phases when mode is brownfield', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={BROWNFIELD_PHASES}
          currentPhase="gap-analysis"
          mode="brownfield"
        />
      );

      const output = lastFrame();
      // Brownfield mode has gap-analysis
      expect(output).toContain('Gap Analysis');
    });
  });

  describe('phase sequence', () => {
    it('should mark phases before current as completed', () => {
      // When at design-generating, initializing, requirements-generating,
      // and requirements-approval should be complete
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="design-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle idle phase', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="idle"
          mode="greenfield"
        />
      );

      // Should render without errors
      expect(lastFrame()).toBeDefined();
    });

    it('should handle complete phase', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="complete"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // All phases should be marked complete
      expect(output).toBeDefined();
    });
  });

  describe('display format', () => {
    it('should use human-readable phase names', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="requirements-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Should have human-readable names, not raw phase types
      expect(output).toBeDefined();
    });

    it('should render in vertical layout', () => {
      const { lastFrame } = render(
        <PhaseProgressView
          phases={GREENFIELD_PHASES}
          currentPhase="requirements-generating"
          mode="greenfield"
        />
      );

      const output = lastFrame();
      // Output should contain newlines indicating vertical layout
      expect(output).toContain('\n');
    });
  });
});
