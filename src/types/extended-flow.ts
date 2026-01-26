/**
 * Extended Flow Types
 * Task 2.1: Define extended flow phase types and events
 * Requirements: 2.1, 2.5
 */

/**
 * Workflow mode - greenfield for new projects, brownfield for existing
 * Requirements: 2.5 - Support both greenfield and brownfield phase sequences
 */
export type WorkflowMode = 'greenfield' | 'brownfield';

/**
 * Extended FlowPhase discriminated union
 * Requirements: 2.1 - Define workflow phases including brownfield-specific phases
 */
export type ExtendedFlowPhase =
  // Common phases
  | { type: 'idle' }
  | { type: 'initializing'; feature: string; description: string }
  // Requirements phases
  | { type: 'requirements-generating'; feature: string }
  | { type: 'requirements-approval'; feature: string }
  // Brownfield: Gap analysis after requirements
  | { type: 'gap-analysis'; feature: string }
  | { type: 'gap-review'; feature: string }
  // Design phases
  | { type: 'design-generating'; feature: string }
  | { type: 'design-approval'; feature: string }
  // Brownfield: Design validation after design
  | { type: 'design-validation'; feature: string }
  | { type: 'design-validation-review'; feature: string }
  // Tasks phases
  | { type: 'tasks-generating'; feature: string }
  | { type: 'tasks-approval'; feature: string }
  // Implementation phases
  | { type: 'implementing'; feature: string; currentTask: number; totalTasks: number }
  | { type: 'paused'; feature: string; pausedAt: number; totalTasks: number }
  // Validation and PR phases
  | { type: 'validation'; feature: string }
  | { type: 'pr'; feature: string }
  | { type: 'merge-decision'; feature: string; prUrl: string }
  // Terminal phases
  | { type: 'complete'; feature: string }
  | { type: 'aborted'; feature: string; reason: string }
  | { type: 'error'; feature: string; error: string };

/**
 * Extended FlowEvent discriminated union
 * Requirements: 2.1 - Define events including task/PR events
 */
export type ExtendedFlowEvent =
  | { type: 'START'; feature: string; description: string; mode: WorkflowMode }
  | { type: 'RESUME'; feature: string }
  | { type: 'PHASE_COMPLETE' }
  | { type: 'PHASE_COMPLETE_WITH_DATA'; data: Record<string, unknown> }
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'PAUSE' }
  | { type: 'ABORT'; reason: string }
  | { type: 'ERROR'; error: string }
  | { type: 'TASK_COMPLETE'; taskIndex: number }
  | { type: 'PR_CREATED'; prUrl: string }
  | { type: 'MERGE' }
  | { type: 'SKIP_MERGE' };

/**
 * Greenfield phase sequence constant
 * Requirements: 2.5 - Define valid phase order for greenfield mode
 */
export const GREENFIELD_PHASES: readonly ExtendedFlowPhase['type'][] = [
  'initializing',
  'requirements-generating',
  'requirements-approval',
  'design-generating',
  'design-approval',
  'tasks-generating',
  'tasks-approval',
  'implementing',
  'validation',
  'pr',
  'merge-decision',
  'complete'
] as const;

/**
 * Brownfield phase sequence constant
 * Requirements: 2.5 - Define valid phase order for brownfield mode
 */
export const BROWNFIELD_PHASES: readonly ExtendedFlowPhase['type'][] = [
  'initializing',
  'requirements-generating',
  'requirements-approval',
  'gap-analysis',
  'gap-review',
  'design-generating',
  'design-approval',
  'design-validation',
  'design-validation-review',
  'tasks-generating',
  'tasks-approval',
  'implementing',
  'validation',
  'pr',
  'merge-decision',
  'complete'
] as const;

/**
 * Approval phases - require user input to proceed
 */
const APPROVAL_PHASES: ReadonlySet<ExtendedFlowPhase['type']> = new Set([
  'requirements-approval',
  'design-approval',
  'tasks-approval',
  'gap-review',
  'design-validation-review',
  'merge-decision'
]);

/**
 * Generating/executing phases - agent or automation is working
 */
const GENERATING_PHASES: ReadonlySet<ExtendedFlowPhase['type']> = new Set([
  'initializing',
  'requirements-generating',
  'design-generating',
  'tasks-generating',
  'gap-analysis',
  'design-validation',
  'implementing',
  'validation',
  'pr'
]);

/**
 * Terminal phases - flow has ended
 */
const TERMINAL_PHASES: ReadonlySet<ExtendedFlowPhase['type']> = new Set([
  'complete',
  'aborted',
  'error'
]);

/**
 * Check if a phase type is an approval phase
 */
export function isApprovalPhase(phaseType: ExtendedFlowPhase['type']): boolean {
  return APPROVAL_PHASES.has(phaseType);
}

/**
 * Check if a phase type is a generating phase
 */
export function isGeneratingPhase(phaseType: ExtendedFlowPhase['type']): boolean {
  return GENERATING_PHASES.has(phaseType);
}

/**
 * Check if a phase type is a terminal phase
 */
export function isTerminalPhase(phaseType: ExtendedFlowPhase['type']): boolean {
  return TERMINAL_PHASES.has(phaseType);
}

/**
 * Get the phase sequence for a workflow mode
 */
export function getPhaseSequence(
  mode: WorkflowMode
): readonly ExtendedFlowPhase['type'][] {
  return mode === 'brownfield' ? BROWNFIELD_PHASES : GREENFIELD_PHASES;
}

/**
 * Extended FlowState interface with workflow mode and PR info
 */
export interface ExtendedFlowState {
  readonly feature: string;
  readonly phase: ExtendedFlowPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly ExtendedFlowPhase[];
  readonly metadata: {
    readonly description: string;
    readonly mode: WorkflowMode;
    readonly tier?: string;
    readonly worktreePath?: string;
    readonly prUrl?: string;
    readonly prNumber?: number;
  };
}
