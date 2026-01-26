/**
 * AbortScreen Component Tests
 * Task 6: Abort Screen Implementation
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import type { ScreenProps } from '../../../src/components/screens/ScreenProps.js';

// Mock services
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

vi.mock('../../../src/services/WorktreeService.js', () => ({
  createWorktreeService: vi.fn(() => ({
    check: vi.fn().mockResolvedValue({ exists: false, path: '', branch: '' }),
    create: vi.fn().mockResolvedValue({ success: true, path: '/path', error: undefined }),
    remove: vi.fn().mockResolvedValue({ success: true, path: '/path', error: undefined }),
    list: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../../../src/services/BranchService.js', () => ({
  createBranchService: vi.fn(() => ({
    deleteLocal: vi.fn().mockResolvedValue({ success: true, error: undefined }),
    deleteRemote: vi.fn().mockResolvedValue({ success: true, error: undefined }),
    exists: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../../../src/services/PRStatusFetcher.js', () => ({
  createPRStatusFetcher: vi.fn(() => ({
    getStatus: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue({ success: true, error: undefined })
  }))
}));

// Import after mocking
import { AbortScreen } from '../../../src/components/screens/AbortScreen.js';
import { createStateStore } from '../../../src/services/StateStore.js';
import { createWorktreeService } from '../../../src/services/WorktreeService.js';
import { createBranchService } from '../../../src/services/BranchService.js';
import { createPRStatusFetcher } from '../../../src/services/PRStatusFetcher.js';

const mockCreateStateStore = createStateStore as ReturnType<typeof vi.fn>;
const mockCreateWorktreeService = createWorktreeService as ReturnType<typeof vi.fn>;
const mockCreateBranchService = createBranchService as ReturnType<typeof vi.fn>;
const mockCreatePRStatusFetcher = createPRStatusFetcher as ReturnType<typeof vi.fn>;

describe('AbortScreen', () => {
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

  const createMockState = (prNumber?: number) => ({
    feature: 'test-feature',
    phase: { type: 'implementing', feature: 'test-feature', currentTask: 3, totalTasks: 10 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    metadata: {
      description: 'Test feature',
      mode: 'greenfield' as const,
      worktreePath: '/repo/worktrees/test-feature',
      prNumber
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateStateStore.mockReturnValue({
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      archive: vi.fn().mockResolvedValue(undefined)
    });

    mockCreateWorktreeService.mockReturnValue({
      check: vi.fn().mockResolvedValue({ exists: false, path: '', branch: '' }),
      create: vi.fn().mockResolvedValue({ success: true, path: '/path', error: undefined }),
      remove: vi.fn().mockResolvedValue({ success: true, path: '/path', error: undefined }),
      list: vi.fn().mockResolvedValue([])
    });

    mockCreateBranchService.mockReturnValue({
      deleteLocal: vi.fn().mockResolvedValue({ success: true, error: undefined }),
      deleteRemote: vi.fn().mockResolvedValue({ success: true, error: undefined }),
      exists: vi.fn().mockResolvedValue(true)
    });

    mockCreatePRStatusFetcher.mockReturnValue({
      getStatus: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue({ success: true, error: undefined })
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading indicator initially', () => {
      const { lastFrame } = render(<AbortScreen {...defaultProps} />);

      const output = lastFrame();
      expect(output).toContain('Loading');
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

      const { lastFrame } = render(<AbortScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('No flow found');
    });
  });

  describe('confirmation', () => {
    it('should display confirmation prompt when flow exists', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState()),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<AbortScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      // Should show confirmation or abort options
      expect(output).toContain('abort');
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(<AbortScreen {...defaultProps} />);

      expect(lastFrame()).toBeDefined();
    });

    it('should display feature name', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState()),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<AbortScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('test-feature');
    });
  });
});
