/**
 * ArtifactsSidebar Component
 * Right-side panel showing generated artifacts with keyboard navigation and preview
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Artifact } from '../../types/index.js';

/**
 * Props for ArtifactsSidebar
 */
export interface ArtifactsSidebarProps {
  readonly artifacts: readonly Artifact[];
  readonly worktreePath: string | null;
  readonly onPreview?: (artifact: Artifact) => void;
}

/**
 * Get icon for artifact type based on filename
 */
function getArtifactIcon(filename: string): string {
  if (filename.includes('spec.json')) return '\u25CF';    // ● (config)
  if (filename.includes('requirements')) return '\u2713'; // ✓
  if (filename.includes('gap-analysis')) return '\u2248'; // ≈
  if (filename.includes('design')) return '\u25A1';       // □
  if (filename.includes('tasks')) return '\u2610';        // ☐
  if (filename.includes('research')) return '\uD83D\uDD0D'; // 🔍
  return '\u25CF'; // ●
}

/**
 * Get color for artifact based on filename
 */
function getArtifactColor(filename: string): string {
  if (filename.includes('spec.json')) return 'yellow';
  if (filename.includes('requirements')) return 'green';
  if (filename.includes('gap-analysis')) return 'cyan';
  if (filename.includes('design')) return 'blue';
  if (filename.includes('tasks')) return 'magenta';
  return 'white';
}

/**
 * ArtifactsSidebar Component
 * Displays generated artifacts with keyboard navigation and preview support
 */
export const ArtifactsSidebar: React.FC<ArtifactsSidebarProps> = ({
  artifacts,
  worktreePath: _worktreePath,  // Reserved for future use (terminal hyperlinks)
  onPreview,
}) => {
  // Filter out any invalid artifacts
  const validArtifacts = artifacts.filter(a => a && a.name && a.path);

  // Track selected artifact index for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Clamp selectedIndex when artifacts change to ensure it stays within valid range
  useEffect(() => {
    if (validArtifacts.length > 0 && selectedIndex >= validArtifacts.length) {
      setSelectedIndex(validArtifacts.length - 1);
    }
  }, [validArtifacts.length, selectedIndex]);

  // Handle keyboard input for navigation and selection
  useInput((input, key) => {
    // Only handle input if we have artifacts and a preview callback
    if (validArtifacts.length === 0) return;

    // Arrow Up: Move selection up
    if (key.upArrow) {
      setSelectedIndex(prev => {
        if (prev === 0) return validArtifacts.length - 1; // Wrap to last
        return prev - 1;
      });
    }

    // Arrow Down: Move selection down
    if (key.downArrow) {
      setSelectedIndex(prev => {
        if (prev === validArtifacts.length - 1) return 0; // Wrap to first
        return prev + 1;
      });
    }

    // Enter or Space: Trigger preview
    if ((key.return || input === ' ') && onPreview) {
      const selected = validArtifacts[selectedIndex];
      if (selected) {
        onPreview(selected);
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginLeft={1}
      width={22}
    >
      {/* Header */}
      <Text bold color="magenta">Artifacts</Text>

      {/* Artifacts list */}
      <Box flexDirection="column" marginTop={1}>
        {validArtifacts.length === 0 ? (
          <Text dimColor italic>No artifacts yet</Text>
        ) : (
          validArtifacts.map((artifact, index) => {
            const icon = getArtifactIcon(artifact.filename);
            const color = getArtifactColor(artifact.filename);
            const isSelected = index === selectedIndex;

            return (
              <Box key={`${artifact.path}-${index}`} marginBottom={index < validArtifacts.length - 1 ? 1 : 0}>
                <Text color={color} inverse={isSelected} bold={isSelected}>
                  {isSelected ? '▶ ' : '  '}{icon} {artifact.filename}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      {/* Full path for copying - show relative path */}
      {validArtifacts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>─────────────────</Text>
          <Text dimColor italic>Path:</Text>
          <Text dimColor>{validArtifacts[0]?.path.split('/').slice(0, -1).join('/') + '/'}</Text>
        </Box>
      )}
    </Box>
  );
};
