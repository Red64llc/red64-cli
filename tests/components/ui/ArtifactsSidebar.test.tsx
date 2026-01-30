/**
 * ArtifactsSidebar Component Tests
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
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      name: 'Design',
      filename: 'design.md',
      path: '.red64/specs/test-feature/design.md',
      phase: 'design-generating',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={[]} worktreePath={null} />
      );
      expect(lastFrame()).toBeDefined();
    });

    it('should display "Artifacts" title', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={[]} worktreePath={null} />
      );
      expect(lastFrame()).toContain('Artifacts');
    });

    it('should show empty state when no artifacts', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={[]} worktreePath={null} />
      );
      // Text may wrap across lines in terminal
      expect(lastFrame()).toContain('No artifacts');
    });
  });

  describe('artifact display', () => {
    it('should display artifact filenames', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={mockArtifacts} worktreePath="/test/path" />
      );
      expect(lastFrame()).toContain('requirements.md');
      expect(lastFrame()).toContain('design.md');
    });

    it('should display path section when artifacts exist', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={mockArtifacts} worktreePath="/test/path" />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Path:');
    });

    it('should show relative spec path when artifacts exist', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={mockArtifacts} worktreePath="/test/path" />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('.red64/specs');
    });

    it('should not show path section when no artifacts', () => {
      const { lastFrame } = render(
        <ArtifactsSidebar artifacts={[]} worktreePath={null} />
      );
      expect(lastFrame()).not.toContain('Path:');
    });
  });
});
