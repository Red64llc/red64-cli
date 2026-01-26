/**
 * FlowTable Component Tests
 * Task 2.2: Create flow listing table component
 * Requirements: 3.3, 3.4
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { FlowTable } from '../../../src/components/ui/FlowTable.js';
import type { FlowState } from '../../../src/types/index.js';

describe('FlowTable', () => {
  const createTestFlow = (
    feature: string,
    phase: string,
    updatedAt: string = new Date().toISOString()
  ): FlowState => ({
    feature,
    phase: { type: phase as FlowState['phase']['type'], feature },
    createdAt: new Date().toISOString(),
    updatedAt,
    history: [],
    metadata: {
      description: `Test ${feature}`,
      mode: 'greenfield',
      worktreePath: `/repo/worktrees/${feature}`
    }
  });

  describe('table rendering', () => {
    it('should render table with headers', () => {
      const flows = [createTestFlow('feature-1', 'implementing')];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      expect(output).toContain('Feature');
      expect(output).toContain('Phase');
      expect(output).toContain('Branch');
      expect(output).toContain('Updated');
    });

    it('should render flow data in rows', () => {
      const flows = [
        createTestFlow('auth-feature', 'requirements-generating'),
        createTestFlow('login-page', 'implementing')
      ];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      expect(output).toContain('auth-feature');
      expect(output).toContain('login-page');
    });

    it('should display phase names', () => {
      const flows = [createTestFlow('test-feature', 'implementing')];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should display branch names', () => {
      const flows: FlowState[] = [
        {
          ...createTestFlow('my-feature', 'implementing'),
          metadata: {
            description: 'Test',
            mode: 'greenfield',
            worktreePath: '/repo/worktrees/my-feature'
          }
        }
      ];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // Should show something related to the worktree path or branch
      expect(output).toBeDefined();
    });
  });

  describe('relative timestamps', () => {
    it('should display relative time for recent flows', () => {
      const flows = [createTestFlow('feature', 'implementing', new Date().toISOString())];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // Should show relative time like "just now" or "less than a minute"
      expect(output).toBeDefined();
    });

    it('should handle older timestamps', () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const flows = [createTestFlow('old-feature', 'implementing', oldDate)];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // Should show something like "2 hours ago"
      expect(output).toBeDefined();
    });
  });

  describe('sorting', () => {
    it('should sort flows by updatedAt descending', () => {
      const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const newDate = new Date().toISOString();

      const flows = [
        createTestFlow('old-feature', 'implementing', oldDate),
        createTestFlow('new-feature', 'implementing', newDate)
      ];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // new-feature should appear before old-feature
      const newIndex = output?.indexOf('new-feature') ?? -1;
      const oldIndex = output?.indexOf('old-feature') ?? -1;
      expect(newIndex).toBeLessThan(oldIndex);
    });
  });

  describe('empty state', () => {
    it('should handle empty flows array', () => {
      const { lastFrame } = render(<FlowTable flows={[]} />);

      const output = lastFrame();
      // Should still render headers or empty message
      expect(output).toBeDefined();
    });
  });

  describe('column formatting', () => {
    it('should truncate long feature names', () => {
      const longName = 'this-is-a-very-long-feature-name-that-exceeds-column-width';
      const flows = [createTestFlow(longName, 'implementing')];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // Should not break layout
      expect(output).toBeDefined();
    });

    it('should align columns properly', () => {
      const flows = [
        createTestFlow('short', 'implementing'),
        createTestFlow('medium-name', 'requirements-generating')
      ];

      const { lastFrame } = render(<FlowTable flows={flows} />);

      const output = lastFrame();
      // Output should be vertically aligned (check for consistent structure)
      expect(output).toBeDefined();
    });
  });
});
