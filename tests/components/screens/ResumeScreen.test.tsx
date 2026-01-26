/**
 * ResumeScreen Component Tests
 * Task 3: Resume Screen Implementation
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';
import type { ScreenProps } from '../../../src/components/screens/ScreenProps.js';

// We need to mock the modules before importing the component
vi.mock('../../../src/services/StateStore.js', () => ({
  createStateStore: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    archive: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/services/GitStatusChecker.js', () => ({
  createGitStatusChecker: vi.fn(() => ({
    check: vi.fn().mockResolvedValue({ hasChanges: false, staged: 0, unstaged: 0, untracked: 0 }),
    hasUncommittedChanges: vi.fn().mockResolvedValue(false)
  }))
}));

// Import after mocking
import { ResumeScreen } from '../../../src/components/screens/ResumeScreen.js';
import { createStateStore } from '../../../src/services/StateStore.js';
import { createGitStatusChecker } from '../../../src/services/GitStatusChecker.js';

const mockCreateStateStore = createStateStore as ReturnType<typeof vi.fn>;
const mockCreateGitStatusChecker = createGitStatusChecker as ReturnType<typeof vi.fn>;

describe('ResumeScreen', () => {
  const defaultProps: ScreenProps = {
    args: ['test-feature'],
    flags: {
      skipPermissions: false,
      brownfield: false,
      greenfield: true,
      tier: undefined,
      help: false,
      version: false
    }
  };

  const createMockState = (phase: string = 'implementing') => ({
    feature: 'test-feature',
    phase: { type: phase, feature: 'test-feature', currentTask: 1, totalTasks: 5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    metadata: {
      description: 'Test feature',
      mode: 'greenfield' as const,
      worktreePath: '/repo/worktrees/test-feature'
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCreateStateStore.mockReturnValue({
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      archive: vi.fn().mockResolvedValue(undefined)
    });

    mockCreateGitStatusChecker.mockReturnValue({
      check: vi.fn().mockResolvedValue({ hasChanges: false, staged: 0, unstaged: 0, untracked: 0 }),
      hasUncommittedChanges: vi.fn().mockResolvedValue(false)
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading indicator initially', () => {
      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      const output = lastFrame();
      // Should show loading state when first rendered
      expect(output).toContain('Loading');
    });

    it('should call state store load with feature name', async () => {
      const mockLoad = vi.fn().mockResolvedValue(createMockState());
      mockCreateStateStore.mockReturnValue({
        load: mockLoad,
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      render(<ResumeScreen {...defaultProps} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLoad).toHaveBeenCalledWith('test-feature');
    });
  });

  describe('flow not found', () => {
    it('should display error when no flow exists', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      // Should show error message about flow not found
      expect(output).toContain('No flow found');
      expect(output).toContain('test-feature');
    });
  });

  describe('phase progress display', () => {
    it('should display flow information when state is loaded', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState('design-generating')),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Phase Progress');
    });
  });

  describe('uncommitted changes', () => {
    it('should show uncommitted changes prompt when changes detected', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState()),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      mockCreateGitStatusChecker.mockReturnValue({
        check: vi.fn().mockResolvedValue({ hasChanges: true, staged: 1, unstaged: 2, untracked: 3 }),
        hasUncommittedChanges: vi.fn().mockResolvedValue(true)
      });

      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Uncommitted changes');
    });
  });

  describe('missing feature argument', () => {
    it('should show error when feature name is missing', async () => {
      const propsWithoutArgs: ScreenProps = {
        ...defaultProps,
        args: []
      };

      const { lastFrame } = render(<ResumeScreen {...propsWithoutArgs} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Feature name is required');
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      expect(lastFrame()).toBeDefined();
    });

    it('should display the feature name when flow is loaded', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState()),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ResumeScreen {...defaultProps} />);

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('test-feature');
    });
  });
});
