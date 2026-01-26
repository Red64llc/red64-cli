/**
 * StatusLine component with color coding
 * Requirements: 6.1
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Status } from '../../types/index.js';

/**
 * Props for StatusLine component
 */
interface StatusLineProps {
  readonly label: string;
  readonly status: Status;
  readonly message?: string;
}

/**
 * Map status to color
 * Requirements: 6.1 - green (success), red (errors), yellow (warnings/pending)
 */
function getStatusColor(status: Status): string {
  switch (status) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
    case 'pending':
      return 'yellow';
    case 'running':
      return 'cyan';
    default:
      return 'white';
  }
}

/**
 * Status display with color coding
 * Requirements: 6.1 - Use color coding for status display
 */
export const StatusLine: React.FC<StatusLineProps> = ({
  label,
  status,
  message
}) => {
  const color = getStatusColor(status);

  return (
    <Box>
      <Text>{label}: </Text>
      <Text color={color}>{status}</Text>
      {message && <Text dimColor> - {message}</Text>}
    </Box>
  );
};
