/**
 * Deterministic Flow State Machine
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
 */

import type { FlowPhase, FlowEvent } from '../types/index.js';

/**
 * Flow machine service interface
 * Requirements: 1.1 - Deterministic TypeScript state machine
 */
export interface FlowMachineService {
  getPhase(): FlowPhase;
  send(event: FlowEvent): FlowPhase;
  canTransition(event: FlowEvent): boolean;
}

/**
 * Extract feature from phase if available
 */
function getFeatureFromPhase(phase: FlowPhase): string {
  if (phase.type === 'idle') {
    return '';
  }
  return phase.feature;
}

/**
 * Pure transition function - deterministic state transitions
 * Requirements: 1.1 - Pure transition function with no side effects
 * Requirements: 1.2 - Application owns all flow control logic
 */
export function transition(phase: FlowPhase, event: FlowEvent): FlowPhase {
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
      if (event.type === 'RESUME') {
        // RESUME from idle requires loading state from StateStore
        // The actual resumed phase will be set externally after loading
        return phase;
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
          type: 'requirements-review',
          feature: phase.feature
        };
      }
      break;

    case 'requirements-review':
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
          type: 'design-review',
          feature: phase.feature
        };
      }
      break;

    case 'design-review':
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
          type: 'tasks-review',
          feature: phase.feature
        };
      }
      break;

    case 'tasks-review':
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
 * Requirements: 1.6 - Validate transitions before attempting
 */
function canTransitionFromPhase(phase: FlowPhase, event: FlowEvent): boolean {
  // ABORT and ERROR are always valid (except from terminal states)
  if (event.type === 'ABORT' || event.type === 'ERROR') {
    return phase.type !== 'complete' && phase.type !== 'aborted' && phase.type !== 'error';
  }

  // Check if transition would result in a different phase
  const nextPhase = transition(phase, event);
  return nextPhase !== phase || nextPhase.type !== phase.type;
}

/**
 * Create flow machine service
 * Requirements: 1.1 - Factory function for state machine
 */
export function createFlowMachine(initialPhase?: FlowPhase): FlowMachineService {
  let currentPhase: FlowPhase = initialPhase ?? { type: 'idle' };

  return {
    getPhase(): FlowPhase {
      return currentPhase;
    },

    send(event: FlowEvent): FlowPhase {
      currentPhase = transition(currentPhase, event);
      return currentPhase;
    },

    canTransition(event: FlowEvent): boolean {
      return canTransitionFromPhase(currentPhase, event);
    }
  };
}
