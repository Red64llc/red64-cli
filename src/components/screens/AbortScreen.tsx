/**
 * Abort screen component (shell)
 * Requirements: 4.6
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Abort screen placeholder - actual implementation deferred to red64-flow-management spec
 * Requirements: 4.6 - Abort and cleanup flow
 */
export const AbortScreen: React.FC<ScreenProps> = ({ args }) => {
  const featureName = args[0] ?? 'unnamed';

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">abort</Text>
      <Text>Abort feature flow: {featureName}</Text>
      <Text dimColor>Confirm abort? (not yet implemented)</Text>
    </Box>
  );
};
