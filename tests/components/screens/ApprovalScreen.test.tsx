/**
 * Approval Screen Tests
 * Task 7.1: Create approval screen component for phase gates
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ApprovalScreen } from '../../../src/components/screens/ApprovalScreen.js';
import type { ExtendedFlowPhase } from '../../../src/types/extended-flow.js';

describe('ApprovalScreen', () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnAbort = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render approval screen with phase info', () => {
      const phase: ExtendedFlowPhase = {
        type: 'requirements-approval',
        feature: 'my-feature'
      };

      const { lastFrame } = render(
        <ApprovalScreen
          phase={phase}
          artifactPath="/spec/requirements.md"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('requirements');
      expect(lastFrame()).toContain('my-feature');
    });

    it('should display design approval phase', () => {
      const phase: ExtendedFlowPhase = {
        type: 'design-approval',
        feature: 'test-feature'
      };

      const { lastFrame } = render(
        <ApprovalScreen
          phase={phase}
          artifactPath="/spec/design.md"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('design');
    });

    it('should display tasks approval phase', () => {
      const phase: ExtendedFlowPhase = {
        type: 'tasks-approval',
        feature: 'feature'
      };

      const { lastFrame } = render(
        <ApprovalScreen
          phase={phase}
          artifactPath="/spec/tasks.md"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('tasks');
    });

    it('should show action options', () => {
      const phase: ExtendedFlowPhase = {
        type: 'requirements-approval',
        feature: 'feature'
      };

      const { lastFrame } = render(
        <ApprovalScreen
          phase={phase}
          artifactPath="/spec/requirements.md"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAbort={mockOnAbort}
        />
      );

      // Should show options for approve, reject, abort
      const frame = lastFrame();
      expect(frame).toContain('Approve');
    });
  });

  describe('artifact display', () => {
    it('should display artifact path', () => {
      const phase: ExtendedFlowPhase = {
        type: 'requirements-approval',
        feature: 'feature'
      };

      const { lastFrame } = render(
        <ApprovalScreen
          phase={phase}
          artifactPath="/repo/.red64/specs/feature/requirements.md"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('requirements.md');
    });
  });
});
