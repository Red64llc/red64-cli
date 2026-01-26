/**
 * Start Screen Tests
 * Task 6.1: Build start screen component with validation and worktree flow
 * Requirements: 1.1, 1.2, 1.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { StartScreen } from '../../../src/components/screens/StartScreen.js';
import type { GlobalFlags } from '../../../src/types/index.js';

// Mock the services
vi.mock('../../../src/services/FeatureValidator.js', () => ({
  createFeatureValidator: () => ({
    validate: vi.fn((name: string) => {
      if (name === 'valid-feature') {
        return { valid: true, error: undefined };
      }
      if (name === 'Invalid_Name') {
        return {
          valid: false,
          error: 'Feature name must start with lowercase letter (e.g., "my-feature")'
        };
      }
      if (!name) {
        return {
          valid: false,
          error: 'Feature name cannot be empty'
        };
      }
      return { valid: true, error: undefined };
    })
  })
}));

vi.mock('../../../src/services/WorktreeService.js', () => ({
  createWorktreeService: () => ({
    check: vi.fn().mockResolvedValue({ exists: false, path: '', branch: '' }),
    create: vi.fn().mockResolvedValue({ success: true, path: '/repo/worktrees/test', error: undefined }),
    remove: vi.fn(),
    list: vi.fn()
  })
}));

describe('StartScreen', () => {
  const defaultFlags: GlobalFlags = {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render start screen with feature name', () => {
      const { lastFrame } = render(
        <StartScreen args={['my-feature', 'Feature description']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('my-feature');
    });

    it('should display greenfield mode by default', () => {
      const { lastFrame } = render(
        <StartScreen args={['feature', 'desc']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('greenfield');
    });

    it('should display brownfield mode when flag is set', () => {
      const brownfieldFlags: GlobalFlags = {
        ...defaultFlags,
        brownfield: true,
        greenfield: false
      };

      const { lastFrame } = render(
        <StartScreen args={['feature', 'desc']} flags={brownfieldFlags} />
      );

      expect(lastFrame()).toContain('brownfield');
    });
  });

  describe('validation display', () => {
    it('should show feature name in output', () => {
      const { lastFrame } = render(
        <StartScreen args={['my-feature', 'Test']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('my-feature');
    });

    it('should display description', () => {
      const { lastFrame } = render(
        <StartScreen args={['feature', 'My description']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('My description');
    });
  });
});
