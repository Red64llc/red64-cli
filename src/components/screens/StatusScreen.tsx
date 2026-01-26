/**
 * Status screen component (shell)
 * Requirements: 4.4
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Status screen placeholder - actual implementation deferred to red64-flow-management spec
 * Requirements: 4.4 - Show flow status
 */
export const StatusScreen: React.FC<ScreenProps> = ({ args }) => {
  const featureName = args[0];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">status</Text>
      {featureName ? (
        <Text>Status for feature: {featureName}</Text>
      ) : (
        <Text>Status for all active flows</Text>
      )}
    </Box>
  );
};
