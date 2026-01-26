/**
 * Help screen component
 * Requirements: 4.7, 8.5
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';

/**
 * Display comprehensive usage information for all commands
 * Requirements: 4.7, 8.5 - Display detailed usage information with red64 branding
 */
export const HelpScreen: React.FC<ScreenProps> = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Red64 Flow Orchestrator
      </Text>
      <Text></Text>
      <Text bold>Usage:</Text>
      <Text>  red64 init                           Bootstrap project for red64 flows</Text>
      <Text>  red64 start {'<feature>'} {"\"<desc>\""}       Start new feature flow</Text>
      <Text>  red64 resume {'<feature>'}               Resume paused/interrupted flow</Text>
      <Text>  red64 status [feature]               Show flow status</Text>
      <Text>  red64 list                           List all active flows</Text>
      <Text>  red64 abort {'<feature>'}                Abort and cleanup flow</Text>
      <Text>  red64 help                           Show this help</Text>
      <Text></Text>
      <Text bold>Global Options:</Text>
      <Text>  -s, --skip-permissions    Pass skip-permissions to Claude CLI</Text>
      <Text>  -b, --brownfield          Enable brownfield mode (gap analysis)</Text>
      <Text>  -g, --greenfield          Greenfield mode (default)</Text>
      <Text>  -t, --tier {'<name>'}         Use specified Claude config directory</Text>
      <Text>  -h, --help                Show help</Text>
      <Text>  -v, --version             Show version</Text>
    </Box>
  );
};
