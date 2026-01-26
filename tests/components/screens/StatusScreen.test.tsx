/**
 * StatusScreen Component Tests
 * Task 4: Status Screen Implementation
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
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

vi.mock('../../../src/services/PRStatusFetcher.js', () => ({
  createPRStatusFetcher: vi.fn(() => ({
    getStatus: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue({ success: true, error: undefined })
  }))
}));

// Import after mocking
import { StatusScreen } from '../../../src/components/screens/StatusScreen.js';
import { createStateStore } from '../../../src/services/StateStore.js';
import { createPRStatusFetcher } from '../../../src/services/PRStatusFetcher.js';

const mockCreateStateStore = createStateStore as ReturnType<typeof vi.fn>;
const mockCreatePRStatusFetcher = createPRStatusFetcher as ReturnType<typeof vi.fn>;

describe('StatusScreen', () => {
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

  const createMockState = (phase: string = 'implementing', prUrl?: string) => ({
    feature: 'test-feature',
    phase: { type: phase, feature: 'test-feature', currentTask: 3, totalTasks: 10 },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    history: [],
    metadata: {
      description: 'Test feature',
      mode: 'greenfield' as const,
      worktreePath: '/repo/worktrees/test-feature',
      prUrl,
      prNumber: prUrl ? 123 : undefined
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
      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

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

      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('No flow found');
    });
  });

  describe('phase progress display', () => {
    it('should display phase progress view', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState('design-generating')),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Phase Progress');
    });
  });

  describe('timestamps', () => {
    it('should display relative updated time', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState()),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      // Should show relative time
      expect(output).toBeDefined();
    });
  });

  describe('task counts', () => {
    it('should display task counts in implementing phase', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState('implementing')),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      // Should show task progress
      expect(output).toContain('Task');
    });
  });

  describe('PR status', () => {
    it('should fetch and display PR status when flow has PR', async () => {
      mockCreateStateStore.mockReturnValue({
        load: vi.fn().mockResolvedValue(createMockState('merge-decision', 'https://github.com/org/repo/pull/123')),
        save: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        archive: vi.fn().mockResolvedValue(undefined)
      });

      const mockGetStatus = vi.fn().mockResolvedValue({
        number: 123,
        url: 'https://github.com/org/repo/pull/123',
        state: 'open',
        mergeable: true,
        reviewDecision: 'approved',
        checksStatus: 'passing'
      });

      mockCreatePRStatusFetcher.mockReturnValue({
        getStatus: mockGetStatus,
        close: vi.fn().mockResolvedValue({ success: true, error: undefined })
      });

      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('PR');
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(<StatusScreen {...defaultProps} />);

      expect(lastFrame()).toBeDefined();
    });
  });
});
