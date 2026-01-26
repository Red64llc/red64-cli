/**
 * CompleteStep component
 * Task 5.5: Display summary and next steps
 */

import React from 'react';
import { Box, Text, Newline } from 'ink';
import type { InitSummary } from './types.js';

export interface CompleteStepProps {
  readonly summary: InitSummary;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({ summary }) => {
  const { createdDirs, appliedStack, configPath, steeringFiles } = summary;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">Initialization Complete!</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Created directories:</Text>
        {createdDirs.slice(0, 5).map((dir, index) => (
          <Text key={index} dimColor>  {dir}</Text>
        ))}
        {createdDirs.length > 5 && (
          <Text dimColor>  ... and {createdDirs.length - 5} more</Text>
        )}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Stack template:</Text>
        <Text dimColor>  {appliedStack}</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Steering files:</Text>
        {steeringFiles.map((file, index) => (
          <Text key={index} dimColor>  .red64/steering/{file}</Text>
        ))}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Configuration:</Text>
        <Text dimColor>  {configPath}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Next Steps:</Text>
        <Newline />
        <Text>1. Review and customize your steering documents</Text>
        <Text dimColor>   red64 steering</Text>
        <Newline />
        <Text>2. Start a new feature specification</Text>
        <Text dimColor>   red64 start "feature description"</Text>
        <Newline />
        <Text>3. Check available commands</Text>
        <Text dimColor>   red64 help</Text>
      </Box>
    </Box>
  );
};
