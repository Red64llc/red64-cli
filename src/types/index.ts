/**
 * Core type system for flow orchestration
 * Requirements: 1.1, 1.2, 4.1-4.7, 5.1-5.5
 */

/**
 * Status type for UI states
 */
export type Status = 'pending' | 'running' | 'success' | 'error' | 'warning';

/**
 * Core command type union for built-in commands
 * Requirements: 4.1-4.7
 */
export type CoreCommand =
  | 'init'
  | 'start'
  | 'status'
  | 'list'
  | 'abort'
  | 'mcp'
  | 'help'
  | 'plugin';

/**
 * Command type - includes core commands and plugin commands (any string)
 * undefined means no command was provided
 */
export type Command = CoreCommand | string | undefined;

/**
 * Check if a command is a core command
 */
export const CORE_COMMANDS: readonly CoreCommand[] = [
  'init', 'start', 'status', 'list', 'abort', 'mcp', 'help', 'plugin'
] as const;

export function isCoreCommand(cmd: string | undefined): cmd is CoreCommand {
  return cmd !== undefined && (CORE_COMMANDS as readonly string[]).includes(cmd);
}

/**
 * GlobalFlags interface for CLI options
 * Requirements: 5.1-5.5
 */
/**
 * Supported coding agents
 */
export type CodingAgent = 'claude' | 'gemini' | 'codex';

/**
 * MCP server configuration (stdio transport)
 */
export interface McpServerConfig {
  readonly command: string;
  readonly args: string[];
  readonly env?: Record<string, string>;
}

/**
 * Model options per agent
 * Cheap models for development, expensive for production
 */
export const AGENT_MODELS: Record<CodingAgent, { cheap: string; best: string; all: readonly string[] }> = {
  claude: {
    cheap: 'claude-3-5-haiku-latest',
    best: 'claude-opus-4-6',
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
  readonly ollama?: boolean;  // Use local Ollama backend
  // Init command specific flags
  readonly stack?: string;
  readonly 'skip-guided'?: boolean;
  readonly 'no-steering'?: boolean;
  readonly agent?: CodingAgent;
  // Test check flags
  readonly 'skip-tests'?: boolean;
  readonly 'local-image'?: boolean;
  // Implementation granularity
  readonly 'task-level'?: boolean;
  // Plugin command specific flags (Task 10.2)
  readonly registry?: string;      // Custom registry URL for plugin install/search
  readonly 'local-path'?: string;  // Local plugin path for install
  readonly dev?: boolean;          // Dev mode for plugin development
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
 * Updated: Unified with ExtendedFlowPhase to include all brownfield phases
 */
export type FlowPhase =
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
  // Cost and usage tracking per phase
  readonly costUsd?: number;              // Total cost in USD for this phase
  readonly inputTokens?: number;          // Total input tokens for this phase
  readonly outputTokens?: number;         // Total output tokens for this phase
  readonly cacheReadTokens?: number;      // Total cache read tokens
  readonly cacheCreationTokens?: number;  // Total cache creation tokens
}

/**
 * History entry for tracking phase transitions with fine-grained detail
 * Requirement: Fine-grained state tracking for accurate resume
 */
export interface HistoryEntry {
  readonly phase: FlowPhase;
  readonly timestamp: string;           // ISO timestamp
  readonly event?: string;              // Event that triggered transition (e.g., 'APPROVE', 'PHASE_COMPLETE')
  readonly subStep?: string;            // Optional sub-step (e.g., 'generating-started', 'generating-completed')
  readonly metadata?: Record<string, unknown>;  // Optional context (e.g., { taskId: '1.1' })
}

/**
 * Token usage tracking for agent invocations
 * Tracks input/output tokens consumed by Claude or other agents
 */
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly model?: string;              // Model that was used (e.g., "claude-sonnet-4-20250514")
  readonly cacheReadTokens?: number;    // Tokens read from cache (if applicable)
  readonly cacheCreationTokens?: number; // Tokens written to cache (if applicable)
  readonly costUsd?: number;            // Cost in USD for this invocation
}

/**
 * Context usage metrics for a single task/session
 * Extends token tracking with context-aware calculations for smart session management
 */
export interface ContextUsage extends TokenUsage {
  readonly contextWindowSize: number;      // Model's context window (e.g., 200000 or 1000000)
  readonly utilizationPercent: number;     // inputTokens / contextWindowSize * 100
  readonly cumulativeInputTokens: number;  // Running total if tasks shared session
  readonly cumulativeUtilization: number;  // cumulativeInputTokens / contextWindowSize * 100
  readonly modelFamily: string;            // e.g., "opus-4.6", "sonnet-4.5"
}

/**
 * Individual task entry with timestamps and status
 * Requirement: Fine-grained task progress tracking for robust resume
 */
export interface TaskEntry {
  readonly id: string;                          // Task ID (e.g., "1", "1.1", "2")
  readonly title: string;                       // Task title from tasks.md
  readonly startedAt: string | null;            // ISO timestamp when started
  readonly completedAt: string | null;          // ISO timestamp when completed
  readonly status: 'pending' | 'in_progress' | 'completed' | 'failed';
  readonly tokenUsage?: TokenUsage;             // Token usage for this task execution
  readonly contextUsage?: ContextUsage;         // Context-aware metrics for this task
}

/**
 * Grouped task progress tracking with individual task detail
 * Tracks completion at group level (1, 2, 3) with detailed task entries
 * Requirement: Track tasks at group level for cleaner progress visibility + individual timestamps
 */
export interface GroupedTaskProgress {
  readonly completedGroups: readonly number[];  // [1, 2] = groups 1 and 2 complete
  readonly totalGroups: number;                 // Total number of task groups
  readonly currentGroup?: number;               // Currently executing group
  readonly subTasksInCurrentGroup?: {
    readonly completed: readonly string[];      // ["3.1", "3.2"] within group 3
    readonly total: number;
  };
  // Individual task tracking with timestamps (v2 addition)
  readonly taskEntries?: readonly TaskEntry[];  // Full list of tasks with status/timestamps
  readonly currentTaskId?: string | null;       // Currently executing task ID
}

/**
 * Task progress tracking for implementation phase
 * @deprecated Use GroupedTaskProgress instead. Kept for migration compatibility.
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
 * Current state schema version for migrations
 */
export const CURRENT_STATE_VERSION = 2;

/**
 * FlowState interface with feature, phase, timestamps, history, and metadata
 * Requirement: 1.5 - State persistence
 * Updated: Added version field and fine-grained history tracking
 */
export interface FlowState {
  readonly feature: string;
  readonly phase: FlowPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Fine-grained history with timestamps and events
  readonly history: readonly HistoryEntry[];
  readonly metadata: {
    readonly description: string;
    readonly mode: 'greenfield' | 'brownfield';
    readonly tier?: string;
    readonly worktreePath?: string;
    readonly prUrl?: string;
    readonly prNumber?: number;
    readonly resolvedFeatureName?: string; // The actual spec directory name after spec-init
  };
  // Task progress tracking at group level (orchestrator-controlled)
  readonly taskProgress?: GroupedTaskProgress;
  // Phase completion metrics with timing
  readonly phaseMetrics?: {
    readonly [phaseType: string]: PhaseMetric;
  };
  // Artifacts generated during the flow
  readonly artifacts?: readonly Artifact[];
  // Peak context utilization percentage (single task, not cumulative)
  readonly maxContextPercent?: number;
  // Schema version for migrations (default: 1 for backwards compatibility)
  readonly version?: number;
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
  readonly agent?: CodingAgent;  // Which CLI to invoke (default: claude)
  readonly model?: string;  // Model override (e.g., claude-3-5-haiku-latest)
  readonly sandbox?: boolean;  // Run in Docker sandbox
  readonly sandboxImage?: string;  // Override sandbox Docker image
  readonly ollama?: boolean;  // Use local Ollama backend
  readonly mcpServers?: Record<string, McpServerConfig>;
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
  | 'CLI_NOT_FOUND'        // Agent CLI binary not found on PATH
  | 'MODEL_UNAVAILABLE'    // Model not available or overloaded
  | 'MODEL_CRASHED'        // Model process crashed (OOM, killed)
  | 'CONTEXT_EXCEEDED'     // Context length exceeded
  | 'NETWORK_ERROR'        // Network connectivity issues
  | 'PERMISSION_DENIED'    // Permission/safety refusal
  | 'DOCKER_UNAVAILABLE'   // Docker daemon not responding
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
  readonly tokenUsage?: TokenUsage;    // Token usage for this invocation
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
