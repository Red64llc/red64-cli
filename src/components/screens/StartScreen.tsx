/**
 * Start screen component (shell)
 * Requirements: 4.2
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Start screen placeholder - actual implementation deferred to red64-flow-core spec
 * Requirements: 4.2 - Start new feature flow
 */
export const StartScreen: React.FC<ScreenProps> = ({ args, flags }) => {
  const featureName = args[0] ?? 'unnamed';
  const description = args[1] ?? 'No description';

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">start</Text>
      <Text>Starting feature flow: {featureName}</Text>
      <Text dimColor>Description: {description}</Text>
      <Text dimColor>
        Mode: {flags.brownfield ? 'brownfield' : 'greenfield'}
      </Text>
    </Box>
  );
};
