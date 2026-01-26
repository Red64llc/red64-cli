/**
 * ErrorRecoveryPrompt Component Tests
 * Task 2.4: Create error recovery prompt component
 * Requirements: 5.1, 5.2, 5.3
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorRecoveryPrompt, type RecoveryOption } from '../../../src/components/ui/ErrorRecoveryPrompt.js';

describe('ErrorRecoveryPrompt', () => {
  describe('git error options', () => {
    it('should display retry option for git errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Git operation failed')}
          errorType="git"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Retry');
    });

    it('should display skip option for git errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Git operation failed')}
          errorType="git"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Skip');
    });

    it('should display abort option for git errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Git operation failed')}
          errorType="git"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Abort');
    });
  });

  describe('agent error options', () => {
    it('should display retry option for agent errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Agent invocation failed')}
          errorType="agent"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Retry');
    });

    it('should display continue option for agent errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Agent invocation failed')}
          errorType="agent"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      // Agent errors have "Continue" instead of "Skip"
      expect(output).toContain('Continue');
    });

    it('should display abort option for agent errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Agent invocation failed')}
          errorType="agent"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Abort');
    });
  });

  describe('network error options', () => {
    it('should display retry option for network errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Network request failed')}
          errorType="network"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Retry');
    });

    it('should display save-and-exit option for network errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Network request failed')}
          errorType="network"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Save');
    });

    it('should display abort option for network errors', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Network request failed')}
          errorType="network"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Abort');
    });
  });

  describe('error display', () => {
    it('should display the error message', () => {
      const errorMessage = 'Failed to connect to server';

      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error(errorMessage)}
          errorType="network"
          onSelect={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Failed to connect');
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(
        <ErrorRecoveryPrompt
          error={new Error('Test error')}
          errorType="git"
          onSelect={() => {}}
        />
      );

      expect(lastFrame()).toBeDefined();
    });
  });
});
