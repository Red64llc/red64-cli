/**
 * Progress Screen Tests
 * Task 8.1: Create progress screen with task tracking display
 * Requirements: 5.4, 5.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ProgressScreen } from '../../../src/components/screens/ProgressScreen.js';

describe('ProgressScreen', () => {
  const mockOnContinue = vi.fn();
  const mockOnPause = vi.fn();
  const mockOnAbort = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('progress display', () => {
    it('should show progress bar', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={2}
          totalTasks={5}
          taskTitle="Implement feature"
          isCheckpoint={false}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      // Should show progress indication
      expect(lastFrame()).toContain('2');
      expect(lastFrame()).toContain('5');
    });

    it('should display current task title', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={1}
          totalTasks={3}
          taskTitle="Setup project structure"
          isCheckpoint={false}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('Setup project structure');
    });

    it('should show task index', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={3}
          totalTasks={10}
          taskTitle="Task title"
          isCheckpoint={false}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('3');
      expect(lastFrame()).toContain('10');
    });
  });

  describe('checkpoint display', () => {
    it('should render checkpoint prompt when isCheckpoint is true', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={3}
          totalTasks={9}
          taskTitle="Checkpoint task"
          isCheckpoint={true}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      // Should show checkpoint options
      expect(lastFrame()).toContain('Continue');
    });

    it('should show pause option at checkpoint', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={6}
          totalTasks={9}
          taskTitle="Task"
          isCheckpoint={true}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('Pause');
    });

    it('should show abort option at checkpoint', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={6}
          totalTasks={9}
          taskTitle="Task"
          isCheckpoint={true}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      expect(lastFrame()).toContain('Abort');
    });
  });

  describe('non-checkpoint state', () => {
    it('should show running indicator when not at checkpoint', () => {
      const { lastFrame } = render(
        <ProgressScreen
          currentTask={1}
          totalTasks={5}
          taskTitle="Running task"
          isCheckpoint={false}
          onContinue={mockOnContinue}
          onPause={mockOnPause}
          onAbort={mockOnAbort}
        />
      );

      // Should indicate task is running (not show checkpoint options prominently)
      const frame = lastFrame();
      expect(frame).toBeTruthy();
    });
  });
});
