/**
 * Core type system for flow orchestration
 * Requirements: 1.1, 1.2, 4.1-4.7, 5.1-5.5
 */

/**
 * Status type for UI states
 */
export type Status = 'pending' | 'running' | 'success' | 'error' | 'warning';

/**
 * Command type union for all supported commands
 * Requirements: 4.1-4.7
 */
export type Command =
  | 'init'
  | 'start'
  | 'resume'
  | 'status'
  | 'list'
  | 'abort'
  | 'help'
  | undefined;

/**
 * GlobalFlags interface for CLI options
 * Requirements: 5.1-5.5
 */
export interface GlobalFlags {
  readonly skipPermissions: boolean;
  readonly brownfield: boolean;
  readonly greenfield: boolean;
  readonly tier: string | undefined;
  readonly help: boolean;
  readonly version: boolean;
}

/**
 * CLIConfig interface combining command, args, and flags
 * Requirements: 4.1-4.7, 5.1-5.5
 */
export interface CLIConfig {
  readonly command: Command;
  readonly args: readonly string[];
  readonly flags: GlobalFlags;
}

/**
 * FlowPhase discriminated union covering all workflow states
 * Requirement: 1.1 - Deterministic state machine
 */
export type FlowPhase =
  | { type: 'idle' }
  | { type: 'initializing'; feature: string; description: string }
  | { type: 'requirements-generating'; feature: string }
  | { type: 'requirements-review'; feature: string }
  | { type: 'design-generating'; feature: string }
  | { type: 'design-review'; feature: string }
  | { type: 'tasks-generating'; feature: string }
  | { type: 'tasks-review'; feature: string }
  | { type: 'implementing'; feature: string; currentTask: number; totalTasks: number }
  | { type: 'complete'; feature: string }
  | { type: 'aborted'; feature: string; reason: string }
  | { type: 'error'; feature: string; error: string };

/**
 * FlowEvent discriminated union for all valid state transitions
 * Requirement: 1.1 - Deterministic state machine
 */
export type FlowEvent =
  | { type: 'START'; feature: string; description: string }
  | { type: 'RESUME'; feature: string }
  | { type: 'PHASE_COMPLETE' }
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'ABORT'; reason: string }
  | { type: 'ERROR'; error: string };

/**
 * FlowState interface with feature, phase, timestamps, history, and metadata
 * Requirement: 1.5 - State persistence
 */
export interface FlowState {
  readonly feature: string;
  readonly phase: FlowPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly FlowPhase[];
  readonly metadata: {
    readonly description: string;
    readonly mode: 'greenfield' | 'brownfield';
    readonly tier?: string;
  };
}
