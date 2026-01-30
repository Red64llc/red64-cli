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
  | 'status'
  | 'list'
  | 'abort'
  | 'help'
  | undefined;

/**
 * GlobalFlags interface for CLI options
 * Requirements: 5.1-5.5
 */
/**
 * Supported coding agents
 */
export type CodingAgent = 'claude' | 'gemini' | 'codex';

/**
 * Model options per agent
 * Cheap models for development, expensive for production
 */
export const AGENT_MODELS: Record<CodingAgent, { cheap: string; best: string; all: readonly string[] }> = {
  claude: {
    cheap: 'claude-3-5-haiku-latest',
    best: 'claude-sonnet-4-20250514',
    all: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514']
  },
  gemini: {
    cheap: 'gemini-2.0-flash',
    best: 'gemini-2.5-pro',
    all: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash']
  },
  codex: {
    cheap: 'gpt-4o-mini',
    best: 'o1',
    all: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1', 'o3-mini']
  }
};

export interface GlobalFlags {
  readonly skipPermissions: boolean;
  readonly brownfield: boolean;
  readonly greenfield: boolean;
  readonly tier: string | undefined;
  readonly help: boolean;
  readonly version: boolean;
  readonly verbose: boolean;
  readonly yes: boolean;
  readonly sandbox: boolean;
  readonly model?: string;  // Model override (validated against agent)
  // Init command specific flags
  readonly repo?: string;
  readonly stack?: string;
  readonly 'skip-guided'?: boolean;
  readonly 'no-steering'?: boolean;
  readonly 'no-cache'?: boolean;
  readonly agent?: CodingAgent;
  // Test check flags
  readonly 'skip-tests'?: boolean;
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
 * Phase completion metrics for tracking timing per phase
 */
export interface PhaseMetric {
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly elapsedMs?: number;
}

/**
 * Task progress tracking for implementation phase
 */
export interface TaskProgress {
  readonly completedTasks: readonly string[];  // ["1.1", "1.2", "2.1"]
  readonly totalTasks: number;
}

/**
 * Artifact generated during spec-driven development
 * Tracks files created by the framework for easy reference
 */
export interface Artifact {
  readonly name: string;        // Display name (e.g., "Requirements", "Design")
  readonly filename: string;    // File name (e.g., "requirements.md")
  readonly path: string;        // Full path from worktree root
  readonly phase: string;       // Phase that generated it
  readonly createdAt: string;   // ISO timestamp
}

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
    readonly worktreePath?: string;
    readonly prUrl?: string;
    readonly prNumber?: number;
    readonly resolvedFeatureName?: string; // The actual spec directory name after spec-init
  };
  // Task progress tracking (orchestrator-controlled)
  readonly taskProgress?: TaskProgress;
  // Phase completion metrics with timing
  readonly phaseMetrics?: {
    readonly [phaseType: string]: PhaseMetric;
  };
  // Artifacts generated during the flow
  readonly artifacts?: readonly Artifact[];
}

/**
 * Agent invocation options for Claude CLI execution
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */
export interface AgentInvokeOptions {
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly skipPermissions: boolean;
  readonly tier: string | undefined;
  readonly model?: string;  // Model override (e.g., claude-3-5-haiku-latest)
  readonly sandbox?: boolean;  // Run in Docker sandbox
  readonly onOutput?: (chunk: string) => void;
  readonly onError?: (chunk: string) => void;
  readonly timeout?: number;
}

/**
 * Claude CLI error codes for specific failure types
 */
export type ClaudeErrorCode =
  | 'CREDIT_EXHAUSTED'     // Account has no credits
  | 'RATE_LIMITED'         // Rate limit exceeded
  | 'AUTH_FAILED'          // Invalid API key or authentication error
  | 'MODEL_UNAVAILABLE'    // Model not available or overloaded
  | 'CONTEXT_EXCEEDED'     // Context length exceeded
  | 'NETWORK_ERROR'        // Network connectivity issues
  | 'PERMISSION_DENIED'    // Permission/safety refusal
  | 'UNKNOWN';             // Unclassified error

/**
 * Parsed Claude error with actionable information
 */
export interface ClaudeError {
  readonly code: ClaudeErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly suggestion: string;
  readonly retryAfterMs?: number;
}

/**
 * Agent invocation result from Claude CLI
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */
export interface AgentResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly claudeError?: ClaudeError;  // Detected Claude-specific error
}

// Re-export extended flow types
export {
  type ExtendedFlowPhase,
  type ExtendedFlowEvent,
  type ExtendedFlowState,
  type WorkflowMode,
  GREENFIELD_PHASES,
  BROWNFIELD_PHASES,
  isApprovalPhase,
  isGeneratingPhase,
  isTerminalPhase,
  getPhaseSequence
} from './extended-flow.js';

// Re-export service types
export type { GitStatus } from '../services/GitStatusChecker.js';
export type { PRStatus } from '../services/PRStatusFetcher.js';
