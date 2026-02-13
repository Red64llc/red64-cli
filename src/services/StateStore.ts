/**
 * State persistence service
 * Requirements: 1.5, 1.7, 8.2
 */

import { mkdir, readFile, writeFile, rm, readdir, rename, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { FlowState, FlowPhase, HistoryEntry, GroupedTaskProgress, TaskEntry, TokenUsage, ContextUsage, PhaseMetric } from '../types/index.js';
import { CURRENT_STATE_VERSION } from '../types/index.js';

/**
 * Create a new task entry with pending status
 */
export function createTaskEntry(id: string, title: string): TaskEntry {
  return {
    id,
    title,
    startedAt: null,
    completedAt: null,
    status: 'pending'
  };
}

/**
 * Mark a task as started (in_progress)
 */
export function markTaskStarted(entry: TaskEntry): TaskEntry {
  return {
    ...entry,
    startedAt: new Date().toISOString(),
    status: 'in_progress'
  };
}

/**
 * Mark a task as completed with optional token and context usage
 */
export function markTaskCompleted(
  entry: TaskEntry,
  tokenUsage?: TokenUsage,
  contextUsage?: ContextUsage
): TaskEntry {
  return {
    ...entry,
    completedAt: new Date().toISOString(),
    status: 'completed',
    ...(tokenUsage && { tokenUsage }),
    ...(contextUsage && { contextUsage })
  };
}

/**
 * Mark a task as failed
 */
export function markTaskFailed(entry: TaskEntry): TaskEntry {
  return {
    ...entry,
    status: 'failed'
  };
}

/**
 * Update a single task entry in the taskEntries array
 */
export function updateTaskEntry(
  entries: readonly TaskEntry[],
  taskId: string,
  updater: (entry: TaskEntry) => TaskEntry
): readonly TaskEntry[] {
  return entries.map(entry =>
    entry.id === taskId ? updater(entry) : entry
  );
}

/**
 * Get the first task that is in_progress (for resume)
 */
export function getInProgressTask(entries: readonly TaskEntry[]): TaskEntry | undefined {
  return entries.find(entry => entry.status === 'in_progress');
}

/**
 * Get the first pending task (for finding what to execute next)
 */
export function getNextPendingTask(entries: readonly TaskEntry[]): TaskEntry | undefined {
  return entries.find(entry => entry.status === 'pending');
}

/**
 * Get the first failed task (for retry after error)
 */
export function getFirstFailedTask(entries: readonly TaskEntry[]): TaskEntry | undefined {
  return entries.find(entry => entry.status === 'failed');
}

/**
 * Get the task to resume: in_progress first, then failed (retry), then pending
 * Priority: in_progress > failed > pending
 * - in_progress: interrupted task that needs completion
 * - failed: task that errored and needs retry
 * - pending: task that hasn't started yet
 */
export function getResumeTask(entries: readonly TaskEntry[]): TaskEntry | undefined {
  return getInProgressTask(entries) ?? getFirstFailedTask(entries) ?? getNextPendingTask(entries);
}

/**
 * Start tracking a phase metric
 */
export function startPhaseMetric(_phaseType: string): PhaseMetric {
  return {
    startedAt: new Date().toISOString()
  };
}

/**
 * Complete a phase metric with optional token usage for cost tracking
 */
export function completePhaseMetric(
  metric: PhaseMetric,
  tokenUsage?: TokenUsage
): PhaseMetric {
  const completedAt = new Date().toISOString();
  const elapsedMs = new Date(completedAt).getTime() - new Date(metric.startedAt).getTime();

  return {
    ...metric,
    completedAt,
    elapsedMs,
    ...(tokenUsage && {
      costUsd: tokenUsage.costUsd,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      cacheReadTokens: tokenUsage.cacheReadTokens,
      cacheCreationTokens: tokenUsage.cacheCreationTokens
    })
  };
}

/**
 * Accumulate token usage into an existing phase metric
 * Used when a phase has multiple agent invocations (e.g., implementation tasks)
 */
export function accumulatePhaseMetric(
  metric: PhaseMetric,
  tokenUsage?: TokenUsage
): PhaseMetric {
  if (!tokenUsage) return metric;

  return {
    ...metric,
    costUsd: (metric.costUsd ?? 0) + (tokenUsage.costUsd ?? 0),
    inputTokens: (metric.inputTokens ?? 0) + tokenUsage.inputTokens,
    outputTokens: (metric.outputTokens ?? 0) + tokenUsage.outputTokens,
    cacheReadTokens: (metric.cacheReadTokens ?? 0) + (tokenUsage.cacheReadTokens ?? 0),
    cacheCreationTokens: (metric.cacheCreationTokens ?? 0) + (tokenUsage.cacheCreationTokens ?? 0)
  };
}

/**
 * Calculate total cost across all phase metrics
 */
export function calculateTotalCost(phaseMetrics: Record<string, PhaseMetric> | undefined): number {
  if (!phaseMetrics) return 0;
  return Object.values(phaseMetrics).reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
}

import { sanitizeFeatureName } from './WorktreeService.js';

/**
 * State store service interface
 * Requirements: 1.5 - Persist and restore flow state through TypeScript file I/O
 * Task 1.4: Extended with archive capability for abort flows
 */
export interface StateStoreService {
  save(state: FlowState): Promise<void>;
  load(feature: string): Promise<FlowState | undefined>;
  list(): Promise<readonly FlowState[]>;
  delete(feature: string): Promise<void>;
  exists(feature: string): Promise<boolean>;
  archive(feature: string): Promise<void>;
}

/**
 * Get flows directory path
 * Requirements: 8.2 - Use .red64/ as the unified directory
 */
function getFlowsDir(baseDir: string): string {
  return join(baseDir, '.red64', 'flows');
}

/**
 * Get feature state file path
 */
function getStatePath(baseDir: string, feature: string): string {
  return join(getFlowsDir(baseDir), sanitizeFeatureName(feature), 'state.json');
}

/**
 * Get feature directory path
 */
function getFeatureDir(baseDir: string, feature: string): string {
  return join(getFlowsDir(baseDir), sanitizeFeatureName(feature));
}

/**
 * Validate loaded state structure (basic validation before migration)
 * Requirements: 1.7 - Validate state on load
 */
function isValidFlowStateBasic(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.feature === 'string' &&
    typeof obj.phase === 'object' &&
    obj.phase !== null &&
    typeof (obj.phase as Record<string, unknown>).type === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    Array.isArray(obj.history) &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null
  );
}

/**
 * Map legacy phase names to new unified names
 */
const PHASE_NAME_MIGRATION: Record<string, string> = {
  'requirements-review': 'requirements-approval',
  'design-review': 'design-approval',
  'tasks-review': 'tasks-approval'
};

/**
 * Migrate legacy phase to new phase format
 */
function migratePhase(phase: Record<string, unknown>): FlowPhase {
  const type = phase.type as string;
  const newType = PHASE_NAME_MIGRATION[type] ?? type;
  return { ...phase, type: newType } as FlowPhase;
}

/**
 * Migrate legacy history (FlowPhase[]) to new format (HistoryEntry[])
 */
function migrateHistory(
  history: readonly unknown[],
  createdAt: string
): readonly HistoryEntry[] {
  return history.map((item) => {
    // Check if already in new format (has timestamp field)
    if (typeof item === 'object' && item !== null && 'timestamp' in item) {
      // Already migrated - just ensure phase is migrated
      const entry = item as Record<string, unknown>;
      return {
        ...entry,
        phase: migratePhase(entry.phase as Record<string, unknown>)
      } as HistoryEntry;
    }

    // Legacy format: just a FlowPhase
    const phase = item as Record<string, unknown>;
    return {
      phase: migratePhase(phase),
      timestamp: createdAt, // Best guess - use creation time
      event: undefined,
      subStep: undefined,
      metadata: undefined
    } as HistoryEntry;
  });
}

/**
 * Migrate legacy TaskProgress to GroupedTaskProgress with taskEntries
 * Note: Legacy format only has task IDs, not titles - titles will be populated
 * when tasks.md is parsed during implementation
 */
function migrateTaskProgress(
  taskProgress: { completedTasks?: readonly string[]; totalTasks?: number } | undefined
): GroupedTaskProgress | undefined {
  if (!taskProgress?.completedTasks?.length && !taskProgress?.totalTasks) {
    return undefined;
  }

  const completedTasks = taskProgress.completedTasks ?? [];

  // Infer completed groups from sub-task IDs (e.g., "1.1", "1.2" -> group 1)
  const completedGroups = [...new Set(
    completedTasks
      .map(id => parseInt(id.split('.')[0], 10))
      .filter(g => !isNaN(g))
  )].sort((a, b) => a - b);

  // Estimate total groups from highest completed or totalTasks
  const maxCompletedGroup = Math.max(...completedGroups, 0);
  const estimatedTotalGroups = Math.max(maxCompletedGroup, 1);

  // Create taskEntries from old completedTasks (titles unknown - will be filled later)
  // Mark all known completed tasks as completed with migrated timestamp
  const migratedTimestamp = new Date().toISOString();
  const taskEntries: TaskEntry[] = completedTasks.map(id => ({
    id,
    title: '', // Will be populated when tasks.md is parsed
    startedAt: migratedTimestamp, // Best guess for migration
    completedAt: migratedTimestamp,
    status: 'completed' as const
  }));

  return {
    completedGroups,
    totalGroups: estimatedTotalGroups,
    currentGroup: undefined,
    subTasksInCurrentGroup: undefined,
    taskEntries: taskEntries.length > 0 ? taskEntries : undefined,
    currentTaskId: null
  };
}

/**
 * Migrate state from older versions to current version
 * Requirement: Backward compatibility with existing state.json files
 */
function migrateState(data: Record<string, unknown>): FlowState {
  const version = (data.version as number) ?? 1;

  // Already at current version
  if (version >= CURRENT_STATE_VERSION) {
    return data as unknown as FlowState;
  }

  // Migration from v1 to v2
  if (version === 1 || !data.version) {
    const phase = data.phase as Record<string, unknown>;
    const migratedPhase = migratePhase(phase);

    const history = data.history as readonly unknown[];
    const migratedHistory = migrateHistory(history, data.createdAt as string);

    const oldTaskProgress = data.taskProgress as { completedTasks?: readonly string[]; totalTasks?: number } | undefined;
    const migratedTaskProgress = migrateTaskProgress(oldTaskProgress);

    return {
      ...data,
      phase: migratedPhase,
      history: migratedHistory,
      taskProgress: migratedTaskProgress,
      version: CURRENT_STATE_VERSION
    } as unknown as FlowState;
  }

  // Unknown version - return as-is and hope for the best
  return data as unknown as FlowState;
}

/**
 * Create state store service
 * Requirements: 1.5 - State persistence service factory
 */
export function createStateStore(baseDir: string): StateStoreService {
  return {
    /**
     * Save flow state
     * Requirements: 1.5 - Use atomic write pattern (temp file + rename)
     */
    async save(state: FlowState): Promise<void> {
      const featureDir = getFeatureDir(baseDir, state.feature);
      const statePath = getStatePath(baseDir, state.feature);

      // Ensure directory exists
      await mkdir(featureDir, { recursive: true });

      // Atomic write: write to temp file, then rename
      const tempPath = join(featureDir, `state.${randomBytes(8).toString('hex')}.tmp`);

      try {
        await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
        await rename(tempPath, statePath);
      } catch (error) {
        // Clean up temp file on error
        try {
          await rm(tempPath, { force: true });
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    },

    /**
     * Load flow state with automatic migration
     * Requirements: 1.5, 1.7 - Read, validate, and migrate persisted state
     */
    async load(feature: string): Promise<FlowState | undefined> {
      const statePath = getStatePath(baseDir, feature);

      try {
        const content = await readFile(statePath, 'utf-8');
        const data = JSON.parse(content);

        if (!isValidFlowStateBasic(data)) {
          // Invalid state file - treat as non-existent
          return undefined;
        }

        // Migrate to current version if needed
        return migrateState(data as Record<string, unknown>);
      } catch {
        // File doesn't exist or couldn't be read
        return undefined;
      }
    },

    /**
     * List all flow states
     * Requirements: 1.5 - Flow management operations
     */
    async list(): Promise<readonly FlowState[]> {
      const flowsDir = getFlowsDir(baseDir);

      try {
        const entries = await readdir(flowsDir, { withFileTypes: true });
        const features = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);

        const states: FlowState[] = [];

        for (const feature of features) {
          const state = await this.load(feature);
          if (state) {
            states.push(state);
          }
        }

        return states;
      } catch {
        // Directory doesn't exist
        return [];
      }
    },

    /**
     * Delete flow state
     * Requirements: 1.5 - Flow cleanup on abort
     */
    async delete(feature: string): Promise<void> {
      const featureDir = getFeatureDir(baseDir, feature);

      try {
        await rm(featureDir, { recursive: true, force: true });
      } catch {
        // Ignore errors - feature may not exist
      }
    },

    /**
     * Check if flow exists
     * Requirements: 1.5 - Quick existence check
     */
    async exists(feature: string): Promise<boolean> {
      const statePath = getStatePath(baseDir, feature);

      try {
        await access(statePath);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Archive flow state for historical preservation
     * Task 1.4: Rename state.json to state.archived.json
     * Requirements: 4.5 - Archive flow state on abort
     */
    async archive(feature: string): Promise<void> {
      const statePath = getStatePath(baseDir, feature);
      const featureDir = getFeatureDir(baseDir, feature);
      const archivePath = join(featureDir, 'state.archived.json');

      try {
        await access(statePath);
        // Atomic rename for archive
        await rename(statePath, archivePath);
      } catch {
        // State file doesn't exist - nothing to archive
      }
    }
  };
}
