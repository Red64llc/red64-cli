/**
 * Header component with box-drawing characters and branding
 * Requirements: 6.3, 8.4
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for Header component
 */
interface HeaderProps {
  readonly title: string;
  readonly subtitle?: string;
}

/**
 * Header with box-drawing border and branding
 * Requirements: 6.3 - Use box-drawing characters for headers
 * Requirements: 8.4 - Display "Red64 Flow Orchestrator" as title
 */
export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Text bold color="cyan">
        {title}
      </Text>
      {subtitle && (
        <Text dimColor>{subtitle}</Text>
      )}
    </Box>
  );
};
