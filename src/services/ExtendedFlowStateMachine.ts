/**
 * Extended Flow State Machine
 * Task 2.2: Implement mode-aware state transition function
 * Requirements: 2.2, 2.4, 2.5
 */

import type {
  ExtendedFlowPhase,
  ExtendedFlowEvent,
  WorkflowMode
} from '../types/extended-flow.js';

/**
 * Extended flow machine service interface
 * Requirements: 2.2 - Mode-aware state machine
 */
export interface ExtendedFlowMachineService {
  getPhase(): ExtendedFlowPhase;
  getMode(): WorkflowMode;
  send(event: ExtendedFlowEvent): ExtendedFlowPhase;
  canTransition(event: ExtendedFlowEvent): boolean;
  subscribe(listener: (phase: ExtendedFlowPhase) => void): () => void;
}

/**
 * Extract feature from phase if available
 */
function getFeatureFromPhase(phase: ExtendedFlowPhase): string {
  if (phase.type === 'idle') {
    return '';
  }
  return phase.feature;
}

/**
 * Pure transition function - mode-aware state transitions
 * Requirements: 2.2 - Extend existing transition function to handle new phases
 * Requirements: 2.4 - Return error state for invalid transitions
 * Requirements: 2.5 - Use workflow mode to determine valid phase sequences
 */
export function extendedTransition(
  phase: ExtendedFlowPhase,
  event: ExtendedFlowEvent,
  mode: WorkflowMode
): ExtendedFlowPhase {
  const feature = getFeatureFromPhase(phase);

  // Global events that can occur from any phase
  if (event.type === 'ABORT') {
    return {
      type: 'aborted',
      feature: feature || 'unknown',
      reason: event.reason
    };
  }

  if (event.type === 'ERROR') {
    return {
      type: 'error',
      feature: feature || 'unknown',
      error: event.error
    };
  }

  // Phase-specific transitions
  switch (phase.type) {
    case 'idle':
      if (event.type === 'START') {
        return {
          type: 'initializing',
          feature: event.feature,
          description: event.description
        };
      }
      break;

    case 'initializing':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'requirements-generating',
          feature: phase.feature
        };
      }
      break;

    case 'requirements-generating':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'requirements-approval',
          feature: phase.feature
        };
      }
      break;

    case 'requirements-approval':
      if (event.type === 'APPROVE') {
        // Mode-aware: brownfield goes to gap-analysis
        if (mode === 'brownfield') {
          return {
            type: 'gap-analysis',
            feature: phase.feature
          };
        }
        // Greenfield skips gap-analysis
        return {
          type: 'design-generating',
          feature: phase.feature
        };
      }
      if (event.type === 'REJECT') {
        return {
          type: 'requirements-generating',
          feature: phase.feature
        };
      }
      break;

    // Brownfield: Gap analysis phases
    case 'gap-analysis':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'gap-review',
          feature: phase.feature
        };
      }
      break;

    case 'gap-review':
      if (event.type === 'APPROVE') {
        return {
          type: 'design-generating',
          feature: phase.feature
        };
      }
      if (event.type === 'REJECT') {
        return {
          type: 'requirements-generating',
          feature: phase.feature
        };
      }
      break;

    case 'design-generating':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'design-approval',
          feature: phase.feature
        };
      }
      break;

    case 'design-approval':
      if (event.type === 'APPROVE') {
        // Mode-aware: brownfield goes to design-validation
        if (mode === 'brownfield') {
          return {
            type: 'design-validation',
            feature: phase.feature
          };
        }
        // Greenfield skips design-validation
        return {
          type: 'tasks-generating',
          feature: phase.feature
        };
      }
      if (event.type === 'REJECT') {
        return {
          type: 'design-generating',
          feature: phase.feature
        };
      }
      break;

    // Brownfield: Design validation phases
    case 'design-validation':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'design-validation-review',
          feature: phase.feature
        };
      }
      break;

    case 'design-validation-review':
      if (event.type === 'APPROVE') {
        return {
          type: 'tasks-generating',
          feature: phase.feature
        };
      }
      if (event.type === 'REJECT') {
        return {
          type: 'design-generating',
          feature: phase.feature
        };
      }
      break;

    case 'tasks-generating':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'tasks-approval',
          feature: phase.feature
        };
      }
      break;

    case 'tasks-approval':
      if (event.type === 'APPROVE') {
        return {
          type: 'implementing',
          feature: phase.feature,
          currentTask: 1,
          totalTasks: 0 // Will be set when tasks are counted
        };
      }
      if (event.type === 'REJECT') {
        return {
          type: 'tasks-generating',
          feature: phase.feature
        };
      }
      break;

    case 'implementing':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'validation',
          feature: phase.feature
        };
      }
      if (event.type === 'PAUSE') {
        return {
          type: 'paused',
          feature: phase.feature,
          pausedAt: phase.currentTask,
          totalTasks: phase.totalTasks
        };
      }
      if (event.type === 'TASK_COMPLETE') {
        return {
          type: 'implementing',
          feature: phase.feature,
          currentTask: event.taskIndex,
          totalTasks: phase.totalTasks
        };
      }
      break;

    case 'paused':
      if (event.type === 'RESUME') {
        return {
          type: 'implementing',
          feature: phase.feature,
          currentTask: phase.pausedAt,
          totalTasks: phase.totalTasks
        };
      }
      break;

    case 'validation':
      if (event.type === 'PHASE_COMPLETE') {
        return {
          type: 'pr',
          feature: phase.feature
        };
      }
      break;

    case 'pr':
      if (event.type === 'PR_CREATED') {
        return {
          type: 'merge-decision',
          feature: phase.feature,
          prUrl: event.prUrl
        };
      }
      break;

    case 'merge-decision':
      if (event.type === 'MERGE' || event.type === 'SKIP_MERGE') {
        return {
          type: 'complete',
          feature: phase.feature
        };
      }
      break;

    case 'complete':
    case 'aborted':
    case 'error':
      // Terminal states - no transitions except ABORT/ERROR handled above
      break;
  }

  // Invalid transition - return current phase
  return phase;
}

/**
 * Check if a transition is valid from current phase
 */
function canTransitionFromPhase(
  phase: ExtendedFlowPhase,
  event: ExtendedFlowEvent,
  mode: WorkflowMode
): boolean {
  // ABORT and ERROR are always valid (except from terminal states)
  if (event.type === 'ABORT' || event.type === 'ERROR') {
    return phase.type !== 'complete' && phase.type !== 'aborted' && phase.type !== 'error';
  }

  // Check if transition would result in a different phase
  const nextPhase = extendedTransition(phase, event, mode);
  return nextPhase !== phase && nextPhase.type !== phase.type;
}

/**
 * Create extended flow machine service
 * Requirements: 2.2 - Factory function for mode-aware state machine
 * Requirements: 2.5 - Lock mode at START
 */
export function createExtendedFlowMachine(
  initialPhase?: ExtendedFlowPhase,
  initialMode?: WorkflowMode
): ExtendedFlowMachineService {
  let currentPhase: ExtendedFlowPhase = initialPhase ?? { type: 'idle' };
  let mode: WorkflowMode = initialMode ?? 'greenfield';
  const listeners: Set<(phase: ExtendedFlowPhase) => void> = new Set();

  return {
    getPhase(): ExtendedFlowPhase {
      return currentPhase;
    },

    getMode(): WorkflowMode {
      return mode;
    },

    send(event: ExtendedFlowEvent): ExtendedFlowPhase {
      // Lock mode at START event
      if (event.type === 'START') {
        mode = event.mode;
      }

      currentPhase = extendedTransition(currentPhase, event, mode);

      // Notify subscribers
      listeners.forEach(listener => listener(currentPhase));

      return currentPhase;
    },

    canTransition(event: ExtendedFlowEvent): boolean {
      return canTransitionFromPhase(currentPhase, event, mode);
    },

    subscribe(listener: (phase: ExtendedFlowPhase) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
