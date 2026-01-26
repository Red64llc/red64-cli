/**
 * Status screen component
 * Task 4: Status Screen Implementation
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { formatDistanceToNow } from 'date-fns';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState, ExtendedFlowPhase, WorkflowMode, PRStatus } from '../../types/index.js';
import { getPhaseSequence } from '../../types/index.js';
import { createStateStore, type StateStoreService } from '../../services/StateStore.js';
import { createPRStatusFetcher, type PRStatusFetcherService } from '../../services/PRStatusFetcher.js';
import { Spinner, PhaseProgressView, ErrorDisplay } from '../ui/index.js';

/**
 * Status screen state
 * Requirements: 2.1-2.6 - Display detailed flow status
 */
type StatusScreenState =
  | { step: 'loading' }
  | { step: 'not-found'; feature: string }
  | { step: 'loaded'; flowState: FlowState; prStatus: PRStatus | undefined }
  | { step: 'error'; error: string };

/**
 * Get base directory from environment or default
 */
function getBaseDir(): string {
  return process.cwd();
}

/**
 * Format relative timestamp
 * Requirements: 2.3 - Display relative timestamps
 */
function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

/**
 * Get PR status color
 */
function getPRStatusColor(state: PRStatus['state']): string {
  switch (state) {
    case 'open':
      return 'green';
    case 'merged':
      return 'magenta';
    case 'closed':
      return 'red';
    default:
      return 'white';
  }
}

/**
 * StatusScreen Component
 * Displays detailed flow status
 * Requirements: 2.1-2.6 - Status command implementation
 */
export const StatusScreen: React.FC<ScreenProps> = ({ args }) => {
  const featureName = args[0];

  const [state, setState] = useState<StatusScreenState>({ step: 'loading' });
  const [stateStore] = useState<StateStoreService>(() => createStateStore(getBaseDir()));
  const [prFetcher] = useState<PRStatusFetcherService>(() => createPRStatusFetcher());

  // Load flow state on mount
  useEffect(() => {
    if (!featureName) {
      setState({ step: 'error', error: 'Feature name is required. Usage: red64 status <feature>' });
      return;
    }

    const loadState = async () => {
      try {
        // Requirements 2.1 - Load flow state
        const flowState = await stateStore.load(featureName);

        if (!flowState) {
          // Requirements 2.6 - Handle missing state
          setState({ step: 'not-found', feature: featureName });
          return;
        }

        // Requirements 2.4 - Fetch PR status if applicable
        let prStatus: PRStatus | undefined;
        if (flowState.metadata.prUrl || flowState.metadata.prNumber) {
          try {
            const prIdentifier = flowState.metadata.prNumber ?? flowState.metadata.prUrl;
            if (prIdentifier) {
              prStatus = await prFetcher.getStatus(prIdentifier);
            }
          } catch {
            // PR fetch failed - continue without PR info
          }
        }

        setState({ step: 'loaded', flowState, prStatus });
      } catch (error) {
        setState({
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to load flow state'
        });
      }
    };

    loadState();
  }, [featureName, stateStore, prFetcher]);

  // Get workflow mode from flow state
  const getMode = (flowState: FlowState): WorkflowMode => {
    return flowState.metadata.mode ?? 'greenfield';
  };

  // Render based on state
  switch (state.step) {
    case 'loading':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">status</Text>
          </Box>
          <Box marginTop={1}>
            <Spinner label={`Loading status for ${featureName ?? 'feature'}...`} />
          </Box>
        </Box>
      );

    case 'not-found':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">status</Text>
          </Box>
          <Box marginTop={1}>
            <ErrorDisplay
              error={new Error(`No flow found for feature: ${state.feature}`)}
              suggestion={'Start a new flow with: red64 start <feature> "description"'}
            />
          </Box>
        </Box>
      );

    case 'loaded':
      const mode = getMode(state.flowState);
      const phases = getPhaseSequence(mode);
      const { flowState, prStatus } = state;

      return (
        <Box flexDirection="column" padding={1}>
          {/* Header */}
          <Box>
            <Text bold color="cyan">status</Text>
            <Text> - {featureName}</Text>
          </Box>

          {/* Description */}
          <Box marginTop={1}>
            <Text dimColor>{flowState.metadata.description}</Text>
          </Box>

          {/* Requirements 2.1, 2.2 - Phase progress with visual indicators */}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Phase Progress:</Text>
            <Box marginTop={1}>
              <PhaseProgressView
                phases={phases}
                currentPhase={flowState.phase.type as ExtendedFlowPhase['type']}
                mode={mode}
              />
            </Box>
          </Box>

          {/* Requirements 2.5 - Task counts for implementation phase */}
          {flowState.phase.type === 'implementing' && 'currentTask' in flowState.phase && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Task Progress:</Text>
              <Box marginLeft={2}>
                <Text>
                  Task {(flowState.phase as { currentTask: number }).currentTask} of {(flowState.phase as { totalTasks: number }).totalTasks}
                </Text>
              </Box>
            </Box>
          )}

          {/* Requirements 2.4 - PR status display */}
          {prStatus && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>PR Status:</Text>
              <Box marginLeft={2} flexDirection="column">
                <Box>
                  <Text>#{prStatus.number} - </Text>
                  <Text color={getPRStatusColor(prStatus.state)}>{prStatus.state}</Text>
                </Box>
                {prStatus.state === 'open' && (
                  <>
                    <Box>
                      <Text dimColor>Mergeable: </Text>
                      <Text color={prStatus.mergeable ? 'green' : 'red'}>
                        {prStatus.mergeable ? 'Yes' : 'No'}
                      </Text>
                    </Box>
                    <Box>
                      <Text dimColor>Review: </Text>
                      <Text color={prStatus.reviewDecision === 'approved' ? 'green' : 'yellow'}>
                        {prStatus.reviewDecision}
                      </Text>
                    </Box>
                    <Box>
                      <Text dimColor>Checks: </Text>
                      <Text color={prStatus.checksStatus === 'passing' ? 'green' : prStatus.checksStatus === 'failing' ? 'red' : 'yellow'}>
                        {prStatus.checksStatus}
                      </Text>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          )}

          {/* Requirements 2.3 - Timestamps */}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Timestamps:</Text>
            <Box marginLeft={2} flexDirection="column">
              <Box>
                <Text dimColor>Created: </Text>
                <Text>{formatRelativeTime(flowState.createdAt)}</Text>
              </Box>
              <Box>
                <Text dimColor>Updated: </Text>
                <Text>{formatRelativeTime(flowState.updatedAt)}</Text>
              </Box>
            </Box>
          </Box>

          {/* Mode */}
          <Box marginTop={1}>
            <Text dimColor>Mode: {mode}</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">status</Text>
          </Box>
          <Box marginTop={1}>
            <ErrorDisplay
              error={new Error(state.error)}
              suggestion="Check the feature name and try again."
            />
          </Box>
        </Box>
      );
  }
};
