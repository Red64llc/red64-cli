/**
 * List screen component (shell)
 * Requirements: 4.5
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * List screen placeholder - actual implementation deferred to red64-flow-management spec
 * Requirements: 4.5 - List all active flows
 */
export const ListScreen: React.FC<ScreenProps> = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">list</Text>
      <Text>Active flows:</Text>
      <Text dimColor>No active flows found.</Text>
    </Box>
  );
};
