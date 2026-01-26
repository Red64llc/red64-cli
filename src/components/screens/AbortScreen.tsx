/**
 * Abort screen component
 * Task 6: Abort Screen Implementation
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState } from '../../types/index.js';
import { createStateStore, type StateStoreService } from '../../services/StateStore.js';
import { createWorktreeService, type WorktreeServiceInterface } from '../../services/WorktreeService.js';
import { createBranchService, type BranchServiceInterface } from '../../services/BranchService.js';
import { createPRStatusFetcher, type PRStatusFetcherService } from '../../services/PRStatusFetcher.js';
import { Spinner, ErrorDisplay, SelectMenu, type SelectMenuItem } from '../ui/index.js';

/**
 * Cleanup result tracking
 * Requirements: 4.6 - Report cleanup results
 */
interface CleanupResult {
  readonly action: string;
  readonly success: boolean;
  readonly error: string | undefined;
}

/**
 * Abort screen state
 * Requirements: 4.1-4.6 - Abort flow states
 */
type AbortScreenState =
  | { step: 'loading' }
  | { step: 'not-found'; feature: string }
  | { step: 'confirm'; flowState: FlowState }
  | { step: 'branch-options'; flowState: FlowState }
  | { step: 'cleaning'; flowState: FlowState; results: readonly CleanupResult[] }
  | { step: 'complete'; results: readonly CleanupResult[] }
  | { step: 'cancelled' }
  | { step: 'error'; error: string };

/**
 * Confirmation options
 */
type ConfirmAction = 'yes' | 'no';

const confirmOptions: SelectMenuItem<ConfirmAction>[] = [
  { label: 'Yes, abort this flow', value: 'yes' },
  { label: 'No, cancel', value: 'no' }
];

/**
 * Branch deletion options
 */
type BranchAction = 'delete' | 'keep';

const branchOptions: SelectMenuItem<BranchAction>[] = [
  { label: 'Delete branch', value: 'delete' },
  { label: 'Keep branch', value: 'keep' }
];

/**
 * Get base directory from environment or default
 */
function getBaseDir(): string {
  return process.cwd();
}

/**
 * AbortScreen Component
 * Aborts a flow with confirmation and cleanup
 * Requirements: 4.1-4.6 - Abort command implementation
 */
export const AbortScreen: React.FC<ScreenProps> = ({ args }) => {
  const { exit } = useApp();
  const featureName = args[0];

  const [state, setState] = useState<AbortScreenState>({ step: 'loading' });
  const [stateStore] = useState<StateStoreService>(() => createStateStore(getBaseDir()));
  const [worktreeService] = useState<WorktreeServiceInterface>(() => createWorktreeService());
  const [branchService] = useState<BranchServiceInterface>(() => createBranchService());
  const [prFetcher] = useState<PRStatusFetcherService>(() => createPRStatusFetcher());

  // Load flow state on mount
  useEffect(() => {
    if (!featureName) {
      setState({ step: 'error', error: 'Feature name is required. Usage: red64 abort <feature>' });
      return;
    }

    const loadState = async () => {
      try {
        const flowState = await stateStore.load(featureName);

        if (!flowState) {
          setState({ step: 'not-found', feature: featureName });
          return;
        }

        // Requirements 4.1 - Show confirmation prompt
        setState({ step: 'confirm', flowState });
      } catch (error) {
        setState({
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to load flow state'
        });
      }
    };

    loadState();
  }, [featureName, stateStore]);

  // Handle confirmation
  const handleConfirm = (item: SelectMenuItem<ConfirmAction>) => {
    if (state.step !== 'confirm') return;

    if (item.value === 'no') {
      setState({ step: 'cancelled' });
      setTimeout(() => exit(), 1000);
      return;
    }

    // Requirements 4.2 - Show branch options
    setState({ step: 'branch-options', flowState: state.flowState });
  };

  // Handle branch decision
  const handleBranchDecision = async (item: SelectMenuItem<BranchAction>) => {
    if (state.step !== 'branch-options') return;

    setState({ step: 'cleaning', flowState: state.flowState, results: [] });

    // Start cleanup
    await performCleanup(state.flowState, item.value === 'delete');
  };

  // Perform cleanup operations
  const performCleanup = async (flowState: FlowState, deleteBranchFlag: boolean) => {
    const results: CleanupResult[] = [];

    // Requirements 4.3 - Close PR if exists
    if (flowState.metadata.prNumber) {
      try {
        const prResult = await prFetcher.close(flowState.metadata.prNumber);
        results.push({
          action: 'Close PR',
          success: prResult.success,
          error: prResult.error
        });
      } catch (error) {
        results.push({
          action: 'Close PR',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Requirements 4.4 - Remove worktree
    const repoPath = getBaseDir();
    try {
      const worktreeResult = await worktreeService.remove(repoPath, flowState.feature, true);
      results.push({
        action: 'Remove worktree',
        success: worktreeResult.success,
        error: worktreeResult.error
      });
    } catch (error) {
      results.push({
        action: 'Remove worktree',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Delete branch if requested
    if (deleteBranchFlag) {
      const branchName = `feature/${flowState.feature}`;
      try {
        const branchResult = await branchService.deleteLocal(branchName, true);
        results.push({
          action: 'Delete branch',
          success: branchResult.success,
          error: branchResult.error
        });
      } catch (error) {
        results.push({
          action: 'Delete branch',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Requirements 4.5 - Archive flow state
    try {
      await stateStore.archive(flowState.feature);
      results.push({
        action: 'Archive state',
        success: true,
        error: undefined
      });
    } catch (error) {
      results.push({
        action: 'Archive state',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setState({ step: 'complete', results });
  };

  // Render based on state
  switch (state.step) {
    case 'loading':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
          </Box>
          <Box marginTop={1}>
            <Spinner label={`Loading flow state for ${featureName ?? 'feature'}...`} />
          </Box>
        </Box>
      );

    case 'not-found':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
          </Box>
          <Box marginTop={1}>
            <ErrorDisplay
              error={new Error(`No flow found for feature: ${state.feature}`)}
              suggestion="Use 'red64 list' to see active flows."
            />
          </Box>
        </Box>
      );

    case 'confirm':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
            <Text> - {featureName}</Text>
          </Box>

          {/* Requirements 4.1 - Confirmation prompt */}
          <Box marginTop={1} flexDirection="column">
            <Text color="yellow" bold>
              Are you sure you want to abort this flow?
            </Text>
            <Text dimColor>
              This will cleanup the worktree and optionally delete the branch.
            </Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text>Current phase: {state.flowState.phase.type}</Text>
          </Box>

          <Box marginTop={1}>
            <SelectMenu items={confirmOptions} onSelect={handleConfirm} />
          </Box>
        </Box>
      );

    case 'branch-options':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
            <Text> - {featureName}</Text>
          </Box>

          {/* Requirements 4.2 - Branch deletion options */}
          <Box marginTop={1} flexDirection="column">
            <Text>What would you like to do with the branch?</Text>
          </Box>

          <Box marginTop={1}>
            <SelectMenu items={branchOptions} onSelect={handleBranchDecision} />
          </Box>
        </Box>
      );

    case 'cleaning':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
            <Text> - {featureName}</Text>
          </Box>

          <Box marginTop={1}>
            <Spinner label="Cleaning up..." />
          </Box>

          {/* Show completed results so far */}
          {state.results.map((result, index) => (
            <Box key={index}>
              <Text color={result.success ? 'green' : 'red'}>
                {result.success ? '\u2713' : '\u2717'} {result.action}
                {result.error && ` - ${result.error}`}
              </Text>
            </Box>
          ))}
        </Box>
      );

    case 'complete':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
            <Text> - {featureName}</Text>
          </Box>

          {/* Requirements 4.6 - Report cleanup results */}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Cleanup complete:</Text>
            {state.results.map((result, index) => (
              <Box key={index} marginLeft={1}>
                <Text color={result.success ? 'green' : 'red'}>
                  {result.success ? '\u2713' : '\u2717'} {result.action}
                </Text>
                {result.error && (
                  <Text dimColor> - {result.error}</Text>
                )}
              </Box>
            ))}
          </Box>

          <Box marginTop={1}>
            <Text color="green">Flow aborted successfully.</Text>
          </Box>
        </Box>
      );

    case 'cancelled':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
          </Box>
          <Box marginTop={1}>
            <Text>Abort cancelled.</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">abort</Text>
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
