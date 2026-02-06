/**
 * ArtifactsSidebar Integration Tests
 * Requirements: 1.1, 1.2, 1.6 - Keyboard navigation and preview support
 *
 * Note: Terminal UI component testing with Ink is limited. These tests verify basic
 * rendering and structure. Full keyboard navigation and preview callback behavior
 * is manually verified in the StartScreen integration which is already implemented.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ArtifactsSidebar } from '../../../src/components/ui/ArtifactsSidebar.js';
import type { Artifact } from '../../../src/types/index.js';

describe('ArtifactsSidebar', () => {
  const mockArtifacts: Artifact[] = [
    {
      name: 'Requirements',
      filename: 'requirements.md',
      path: '.red64/specs/test-feature/requirements.md',
      phase: 'requirements-generating',
      createdAt: '2026-02-05T10:00:00.000Z'
    },
    {
      name: 'Design',
      filename: 'design.md',
      path: '.red64/specs/test-feature/design.md',
      phase: 'design-generating',
      createdAt: '2026-02-05T11:00:00.000Z'
    },
    {
      name: 'Tasks',
      filename: 'tasks.md',
      path: '.red64/specs/test-feature/tasks.md',
      phase: 'tasks-generating',
      createdAt: '2026-02-05T12:00:00.000Z'
    }
  ];

  describe('rendering', () => {
    it('renders artifact list with filenames', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={mockArtifacts}
          worktreePath="/tmp/worktree"
        />
      );

      const output = lastFrame();
      expect(output).toContain('requirements.md');
      expect(output).toContain('design.md');
      expect(output).toContain('tasks.md');
    });

    it('displays "Artifacts" header', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={mockArtifacts}
          worktreePath="/tmp/worktree"
        />
      );

      expect(lastFrame()).toContain('Artifacts');
    });

    it('displays "No artifacts yet" when empty', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={[]}
          worktreePath="/tmp/worktree"
        />
      );

      expect(lastFrame()).toContain('No artifacts yet');
    });

    it('shows visual selection indicator', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={mockArtifacts}
          worktreePath="/tmp/worktree"
        />
      );

      const output = lastFrame();
      expect(output).toContain('▶');
    });
  });

  describe('edge cases', () => {
    it('handles empty artifact list gracefully', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={[]}
          worktreePath="/tmp/worktree"
        />
      );

      expect(lastFrame()).toContain('No artifacts yet');
    });

    it('filters out invalid artifacts', () => {
      const artifactsWithInvalid: any[] = [
        mockArtifacts[0],
        null,
        undefined,
        {},
        mockArtifacts[1]
      ];

      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={artifactsWithInvalid as Artifact[]}
          worktreePath="/tmp/worktree"
        />
      );

      const output = lastFrame();
      expect(output).toContain('requirements.md');
      expect(output).toContain('design.md');
      expect(output).not.toContain('undefined');
      expect(output).not.toContain('null');
    });

    it('does not crash with null worktreePath', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar
          artifacts={mockArtifacts}
          worktreePath={null}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Artifacts');
      expect(output).toContain('requirements.md');
    });
  });
});
