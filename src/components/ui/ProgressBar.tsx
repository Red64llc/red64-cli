/**
 * ProgressBar component wrapper
 * Requirements: 6.4
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar as InkProgressBar } from '@inkjs/ui';

/**
 * Props for ProgressBar component
 */
interface ProgressBarProps {
  readonly current: number;
  readonly total: number;
  readonly label?: string;
}

/**
 * Progress bar for task counts during implementation phase
 * Requirements: 6.4 - Display progress bars or task counts
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label
}) => {
  const progress = total > 0 ? current / total : 0;

  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      <Box>
        <InkProgressBar value={progress} />
        <Text> {current}/{total}</Text>
      </Box>
    </Box>
  );
};
