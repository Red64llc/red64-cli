/**
 * CompleteStep component
 * Task 5.5: Display summary and next steps
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { InitSummary } from './types.js';

export interface CompleteStepProps {
  readonly summary: InitSummary;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({ summary }) => {
  const { createdDirs, appliedStack, steeringFiles, gitInitialized, gitCommitted } = summary;

  // Format created items compactly
  const createdItems = [
    ...createdDirs.slice(0, 3),
    ...(createdDirs.length > 3 ? [`+${createdDirs.length - 3} more`] : [])
  ].join(', ');

  const steeringList = steeringFiles.length > 0
    ? steeringFiles.map(f => f.replace('.md', '')).join(', ')
    : 'none';

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">✓ Red64 initialized successfully!</Text>
      </Box>

      {/* Summary table */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Stack:     </Text>
          <Text>{appliedStack}</Text>
        </Box>
        <Box>
          <Text dimColor>Steering:  </Text>
          <Text>{steeringList}</Text>
        </Box>
        <Box>
          <Text dimColor>Created:   </Text>
          <Text>{createdItems}</Text>
        </Box>
        {gitInitialized && (
          <Box>
            <Text dimColor>Git:       </Text>
            <Text>{gitCommitted ? 'initialized & committed' : 'initialized'}</Text>
          </Box>
        )}
      </Box>

      {/* Next steps - compact format */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold>Next steps:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text><Text color="cyan">1.</Text> Customize steering → <Text dimColor>red64 steering</Text></Text>
          <Text><Text color="cyan">2.</Text> Start a spec      → <Text dimColor>red64 start "description"</Text></Text>
          <Text><Text color="cyan">3.</Text> View commands     → <Text dimColor>red64 help</Text></Text>
        </Box>
      </Box>
    </Box>
  );
};
