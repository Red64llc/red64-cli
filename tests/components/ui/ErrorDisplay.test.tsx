/**
 * ErrorDisplay Component Tests
 * Task 2.3: Create error display component
 * Requirements: 5.6
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorDisplay } from '../../../src/components/ui/ErrorDisplay.js';

describe('ErrorDisplay', () => {
  describe('error message rendering', () => {
    it('should display the error message', () => {
      const error = new Error('Something went wrong');

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Try again later" />
      );

      const output = lastFrame();
      expect(output).toContain('Something went wrong');
    });

    it('should display error type or prefix', () => {
      const error = new Error('Connection failed');

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Check network" />
      );

      const output = lastFrame();
      // Should indicate this is an error
      expect(output).toContain('Error');
    });
  });

  describe('suggestion rendering', () => {
    it('should display the suggestion', () => {
      const error = new Error('Auth failed');

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Run gh auth login" />
      );

      const output = lastFrame();
      expect(output).toContain('gh auth login');
    });

    it('should indicate suggestion is actionable', () => {
      const error = new Error('Test error');

      const { lastFrame } = render(
        <ErrorDisplay
          error={error}
          suggestion="Check the file path and try again"
        />
      );

      const output = lastFrame();
      expect(output).toContain('file path');
    });
  });

  describe('styling', () => {
    it('should render without crashing', () => {
      const error = new Error('Test');

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Do something" />
      );

      expect(lastFrame()).toBeDefined();
    });

    it('should handle long error messages', () => {
      const longMessage = 'This is a very long error message that spans multiple words and could potentially cause layout issues in the terminal';
      const error = new Error(longMessage);

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Fix it" />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle multi-line suggestions', () => {
      const error = new Error('Failed');

      const { lastFrame } = render(
        <ErrorDisplay
          error={error}
          suggestion="Step 1: Check config\nStep 2: Restart service"
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty suggestion', () => {
      const error = new Error('Error occurred');

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="" />
      );

      const output = lastFrame();
      expect(output).toContain('Error occurred');
    });

    it('should handle error with no message', () => {
      const error = new Error();

      const { lastFrame } = render(
        <ErrorDisplay error={error} suggestion="Generic suggestion" />
      );

      expect(lastFrame()).toBeDefined();
    });
  });
});
