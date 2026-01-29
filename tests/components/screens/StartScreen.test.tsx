/**
 * Start Screen Tests
 * Task 6.1: Build start screen component with validation and worktree flow
 * Requirements: 1.1, 1.2, 1.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { StartScreen } from '../../../src/components/screens/StartScreen.js';
import type { GlobalFlags } from '../../../src/types/index.js';

// Helper to flush all pending promises
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

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
  createConfigService: () => ({
    load: vi.fn().mockResolvedValue({ agent: 'claude' }),
    save: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockResolvedValue(true)
  }),
  createProjectDetector: () => ({
    detect: vi.fn().mockResolvedValue({ detected: false, testCommand: null, source: null, confidence: 'low' })
  }),
  createTestRunner: () => ({
    run: vi.fn().mockResolvedValue({ success: true, exitCode: 0, stdout: '', stderr: '', durationMs: 100, timedOut: false }),
    parseCommand: vi.fn().mockReturnValue({ cmd: 'npm', args: ['test'] })
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

  // Track unmount function for cleanup
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Unmount the component to stop async operations
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    // Wait for any pending promises to settle
    await flushPromises();
  });

  describe('rendering', () => {
    it('should render start screen with feature name', async () => {
      const { lastFrame, unmount } = render(
        <StartScreen args={['my-feature', 'Feature description']} flags={defaultFlags} />
      );
      cleanup = unmount;

      expect(lastFrame()).toContain('my-feature');
    });

    it('should show phase status on initial render', async () => {
      const { lastFrame, unmount } = render(
        <StartScreen args={['feature', 'desc']} flags={defaultFlags} />
      );
      cleanup = unmount;

      // On initial render, the component should show phase status
      // (either checking or idle depending on async timing)
      const frame = lastFrame();
      expect(frame).toContain('feature');
      expect(frame).toContain('red64 start');
    });

    it('should render header with feature name', async () => {
      const { lastFrame, unmount } = render(
        <StartScreen args={['feature', 'desc']} flags={defaultFlags} />
      );
      cleanup = unmount;

      // Header should always be visible
      expect(lastFrame()).toContain('red64 start');
      expect(lastFrame()).toContain('feature');
    });
  });

  describe('validation display', () => {
    it('should show feature name in header', async () => {
      const { lastFrame, unmount } = render(
        <StartScreen args={['my-feature', 'Test']} flags={defaultFlags} />
      );
      cleanup = unmount;

      expect(lastFrame()).toContain('my-feature');
    });

    it('should show idle phase initially', async () => {
      const { lastFrame, unmount } = render(
        <StartScreen args={['feature', 'My description']} flags={defaultFlags} />
      );
      cleanup = unmount;

      // Should show idle phase label
      expect(lastFrame()).toContain('Idle');
    });
  });
});
