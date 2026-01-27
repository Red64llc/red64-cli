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

// Mock the services index
vi.mock('../../../src/services/index.js', () => ({
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
  }),
  createWorktreeService: () => ({
    check: vi.fn().mockResolvedValue({ exists: false, path: '', branch: '' }),
    create: vi.fn().mockResolvedValue({ success: true, path: '/repo/worktrees/test', error: undefined }),
    remove: vi.fn(),
    list: vi.fn()
  }),
  createStateStore: () => ({
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  }),
  createAgentInvoker: () => ({
    invoke: vi.fn().mockResolvedValue({ success: true, exitCode: 0, stdout: '', stderr: '', timedOut: false }),
    abort: vi.fn()
  }),
  createExtendedFlowMachine: () => ({
    current: vi.fn().mockReturnValue({ type: 'idle' }),
    send: vi.fn().mockReturnValue({ type: 'initializing', feature: 'test', description: 'test' }),
    canSend: vi.fn().mockReturnValue(true)
  }),
  createCommitService: () => ({
    stageAndCommit: vi.fn().mockResolvedValue({ success: true, commitHash: 'abc123' }),
    formatTaskCommitMessage: vi.fn().mockReturnValue('test commit')
  }),
  createTaskParser: () => ({
    parse: vi.fn().mockResolvedValue([]),
    getPendingTasks: vi.fn().mockReturnValue([])
  }),
  createSpecInitService: () => ({
    init: vi.fn().mockResolvedValue({ success: true, specDir: '/test/.red64/specs/test', featureName: 'test' }),
    updateTaskApproval: vi.fn().mockResolvedValue({ success: true })
  }),
  createClaudeHealthCheck: () => ({
    check: vi.fn().mockResolvedValue({ healthy: true, message: 'API is ready', durationMs: 100 })
  }),
  createGitStatusChecker: () => ({
    check: vi.fn().mockResolvedValue({ hasChanges: false, staged: 0, unstaged: 0, untracked: 0 })
  }),
  sanitizeFeatureName: (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}));

describe('StartScreen', () => {
  const defaultFlags: GlobalFlags = {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false,
    verbose: false,
    yes: false,
    sandbox: false
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

    it('should show existing flow check on initial render', () => {
      const { lastFrame } = render(
        <StartScreen args={['feature', 'desc']} flags={defaultFlags} />
      );

      // On initial render, the existing flow check should be shown
      expect(lastFrame()).toContain('Checking for existing flow');
    });

    it('should render header with feature name', () => {
      const { lastFrame } = render(
        <StartScreen args={['feature', 'desc']} flags={defaultFlags} />
      );

      // Header should always be visible
      expect(lastFrame()).toContain('red64 start');
      expect(lastFrame()).toContain('feature');
    });
  });

  describe('validation display', () => {
    it('should show feature name in header', () => {
      const { lastFrame } = render(
        <StartScreen args={['my-feature', 'Test']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('my-feature');
    });

    it('should show idle phase initially', () => {
      const { lastFrame } = render(
        <StartScreen args={['feature', 'My description']} flags={defaultFlags} />
      );

      // Should show idle phase label
      expect(lastFrame()).toContain('Idle');
    });
  });
});
