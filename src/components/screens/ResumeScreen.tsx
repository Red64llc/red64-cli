/**
 * Resume screen component (shell)
 * Requirements: 4.3, 1.7
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Resume screen placeholder - actual implementation deferred to red64-flow-core spec
 * Requirements: 4.3 - Resume paused/interrupted flow
 */
export const ResumeScreen: React.FC<ScreenProps> = ({ args }) => {
  const featureName = args[0] ?? 'unnamed';

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">resume</Text>
      <Text>Resuming feature flow: {featureName}</Text>
      <Text dimColor>Loading persisted state...</Text>
    </Box>
  );
};
