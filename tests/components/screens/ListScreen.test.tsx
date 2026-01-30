/**
 * ListScreen Component Tests
 * Task 5: List Screen Implementation
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
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
    create: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue([])
  })),
  sanitizeFeatureName: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-'))
}));

// Import after mocking
import { ListScreen } from '../../../src/components/screens/ListScreen.js';
import { createStateStore } from '../../../src/services/StateStore.js';
import { createWorktreeService } from '../../../src/services/WorktreeService.js';

const mockCreateStateStore = createStateStore as ReturnType<typeof vi.fn>;
const mockCreateWorktreeService = createWorktreeService as ReturnType<typeof vi.fn>;

describe('ListScreen', () => {
  const defaultProps: ScreenProps = {
    args: [],
    flags: {
      skipPermissions: false,
      brownfield: false,
      greenfield: true,
      tier: undefined,
      help: false,
      version: false
    }
  };

  const createMockFlows = () => [
    {
      feature: 'auth-feature',
      phase: { type: 'implementing', feature: 'auth-feature', currentTask: 2, totalTasks: 5 },
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      history: [],
      metadata: {
        description: 'Auth feature',
        mode: 'greenfield' as const,
        worktreePath: '/repo/worktrees/auth-feature'
      }
    },
    {
      feature: 'login-page',
      phase: { type: 'design-generating', feature: 'login-page' },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      history: [],
      metadata: {
        description: 'Login page',
        mode: 'greenfield' as const,
        worktreePath: '/repo/worktrees/login-page'
      }
    }
  ];

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
      create: vi.fn().mockResolvedValue({ success: true }),
      remove: vi.fn().mockResolvedValue({ success: true }),
      list: vi.fn().mockResolvedValue([])
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading indicator initially', () => {
      const { lastFrame } = render(<ListScreen {...defaultProps} />);

      const output = lastFrame();
      expect(output).toContain('Loading');
    });
  });

  describe('empty state', () => {
    it('should display helpful message when no flows exist', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ListScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('No active flows');
      expect(output).toContain('red64 start');
    });
  });

  describe('flow listing', () => {
    it('should display flows in a table', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(createMockFlows()),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ListScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('auth-feature');
      expect(output).toContain('login-page');
    });

    it('should display table headers', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(createMockFlows()),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<ListScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Feature');
      expect(output).toContain('Phase');
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(<ListScreen {...defaultProps} />);

      expect(lastFrame()).toBeDefined();
    });
  });
});
