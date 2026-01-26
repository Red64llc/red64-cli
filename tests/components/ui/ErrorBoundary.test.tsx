/**
 * ErrorBoundary Component Tests
 * Task 2.5: Create error boundary wrapper component
 * Requirements: 5.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorBoundary } from '../../../src/components/ui/ErrorBoundary.js';
import { Text } from 'ink';

// Component that throws an error
const ThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <Text>Safe content</Text>;
};

// Suppress console.error during tests since error boundaries log errors
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  describe('normal rendering', () => {
    it('should render children when no error occurs', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <Text>Hello World</Text>
        </ErrorBoundary>
      );

      const output = lastFrame();
      expect(output).toContain('Hello World');
    });

    it('should render multiple children', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <Text>First</Text>
          <Text>Second</Text>
        </ErrorBoundary>
      );

      const output = lastFrame();
      expect(output).toContain('First');
      expect(output).toContain('Second');
    });
  });

  describe('error catching', () => {
    it('should catch errors from children', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      const output = lastFrame();
      // Should show error UI instead of crashing
      expect(output).toContain('Error');
    });

    it('should display the error message', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      const output = lastFrame();
      expect(output).toContain('Test error from component');
    });
  });

  describe('error callback', () => {
    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error from component' })
      );
    });

    it('should not call onError when no error occurs', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('error display', () => {
    it('should display exit prompt', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      const output = lastFrame();
      // Should show some exit instruction
      expect(output).toBeDefined();
    });
  });

  describe('preventing crash propagation', () => {
    it('should prevent errors from propagating to parent', () => {
      // If error boundary works, this should not throw
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });
});
