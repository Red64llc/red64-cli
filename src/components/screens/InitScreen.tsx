/**
 * Init screen component (shell)
 * Requirements: 4.1
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Init screen placeholder - actual implementation deferred to red64-init spec
 * Requirements: 4.1 - Bootstrap project for red64 flows
 */
export const InitScreen: React.FC<ScreenProps> = ({ flags }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">init</Text>
      <Text>Initializing project for red64 flows...</Text>
      {flags.skipPermissions && (
        <Text dimColor>Skip permissions mode enabled</Text>
      )}
    </Box>
  );
};
