/**
 * OutputRegion component for agent output display
 * Requirements: 7.7
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for OutputRegion component
 */
interface OutputRegionProps {
  readonly lines: readonly string[];
  readonly maxHeight?: number;
  readonly title?: string;
}

/**
 * Scrollable text region for displaying agent output
 * Requirements: 7.7 - Display agent output in a dedicated UI region
 */
export const OutputRegion: React.FC<OutputRegionProps> = ({
  lines,
  maxHeight,
  title
}) => {
  // If maxHeight is set, only show the last N lines
  const displayLines = maxHeight && lines.length > maxHeight
    ? lines.slice(-maxHeight)
    : lines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {title && (
        <Text bold dimColor>
          {title}
        </Text>
      )}
      {displayLines.length === 0 ? (
        <Text dimColor>No output</Text>
      ) : (
        displayLines.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))
      )}
    </Box>
  );
};
