/**
 * List screen component
 * Task 5: List Screen Implementation
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState } from '../../types/index.js';
import { createStateStore, type StateStoreService } from '../../services/StateStore.js';
import { createWorktreeService, type WorktreeServiceInterface } from '../../services/WorktreeService.js';
import { Spinner, FlowTable } from '../ui/index.js';

/**
 * List screen state
 * Requirements: 3.1-3.5 - List all active flows
 */
type ListScreenState =
  | { step: 'loading' }
  | { step: 'loaded'; flows: readonly FlowState[] }
  | { step: 'error'; error: string };

/**
 * Get base directory from environment or default
 */
function getBaseDir(): string {
  return process.cwd();
}

/**
 * ListScreen Component
 * Displays all active flows in a table
 * Requirements: 3.1-3.5 - List command implementation
 */
export const ListScreen: React.FC<ScreenProps> = () => {
  const [state, setState] = useState<ListScreenState>({ step: 'loading' });
  const [stateStore] = useState<StateStoreService>(() => createStateStore(getBaseDir()));
  const [worktreeService] = useState<WorktreeServiceInterface>(() => createWorktreeService());

  // Load all flows on mount
  useEffect(() => {
    const loadFlows = async () => {
      try {
        const baseDir = getBaseDir();

        // Requirements 3.1, 3.2 - Scan and load all flow states
        // First load from main repo
        const mainFlows = await stateStore.list();

        // Also scan worktrees for flow states
        const worktrees = await worktreeService.list(baseDir);
        const worktreeFlows: FlowState[] = [];
        const seenFeatures = new Set(mainFlows.map(f => f.feature));

        for (const worktree of worktrees) {
          // Skip main worktree (already scanned)
          if (worktree.path === baseDir) continue;
          if (!worktree.path) continue;

          const worktreeStateStore = createStateStore(worktree.path);
          const flows = await worktreeStateStore.list();

          for (const flow of flows) {
            // Avoid duplicates - prefer worktree state as it's more current
            if (!seenFeatures.has(flow.feature)) {
              worktreeFlows.push(flow);
              seenFeatures.add(flow.feature);
            }
          }
        }

        const allFlows = [...mainFlows, ...worktreeFlows];
        setState({ step: 'loaded', flows: allFlows });
      } catch (error) {
        setState({
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to load flows'
        });
      }
    };

    loadFlows();
  }, [stateStore, worktreeService]);

  // Render based on state
  switch (state.step) {
    case 'loading':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">list</Text>
          </Box>
          <Box marginTop={1}>
            <Spinner label="Loading active flows..." />
          </Box>
        </Box>
      );

    case 'loaded':
      // Requirements 3.5 - Empty state message
      if (state.flows.length === 0) {
        return (
          <Box flexDirection="column" padding={1}>
            <Box>
              <Text bold color="cyan">list</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text>No active flows found.</Text>
              <Box marginTop={1}>
                <Text dimColor>Start a new flow with: </Text>
                <Text color="yellow">{'red64 start <feature> "description"'}</Text>
              </Box>
            </Box>
          </Box>
        );
      }

      // Requirements 3.3, 3.4 - Display table with flows
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">list</Text>
          </Box>
          <Box marginTop={1}>
            <Text>Active flows ({state.flows.length}):</Text>
          </Box>
          <Box marginTop={1}>
            <FlowTable flows={state.flows} />
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">list</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="red">Error: {state.error}</Text>
          </Box>
        </Box>
      );
  }
};
