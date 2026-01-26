/**
 * FetchStep component
 * Task 5.2: Display download progress and handle errors
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, ProgressBar } from '@inkjs/ui';
import type { BaseStepProps } from './types.js';
import type { FetchProgress } from '../../services/GitHubService.js';

export interface FetchStepProps extends BaseStepProps {
  readonly progress: FetchProgress;
  readonly repo: string;
  readonly version: string;
  readonly fromCache?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPhaseLabel(phase: FetchProgress['phase']): string {
  switch (phase) {
    case 'connecting':
      return 'Connecting to GitHub...';
    case 'downloading':
      return 'Downloading framework files...';
    case 'caching':
      return 'Caching for offline use...';
    default:
      return 'Processing...';
  }
}

export const FetchStep: React.FC<FetchStepProps> = ({
  progress,
  repo,
  version,
  fromCache
}) => {
  const { phase, bytesReceived, totalBytes } = progress;
  const percentage = totalBytes && bytesReceived
    ? Math.round((bytesReceived / totalBytes) * 100)
    : 0;

  if (fromCache) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">Using cached framework files</Text>
        </Box>
        <Text dimColor>Source: {repo}@{version}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Fetching Framework</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Source: {repo}@{version}</Text>
      </Box>

      <Box marginBottom={1}>
        <Spinner label={getPhaseLabel(phase)} />
      </Box>

      {phase === 'downloading' && totalBytes && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <ProgressBar value={percentage} />
          </Box>
          <Text dimColor>
            {formatBytes(bytesReceived ?? 0)} / {formatBytes(totalBytes)} ({percentage}%)
          </Text>
        </Box>
      )}

      {phase === 'downloading' && !totalBytes && bytesReceived && (
        <Text dimColor>Downloaded: {formatBytes(bytesReceived)}</Text>
      )}
    </Box>
  );
};
