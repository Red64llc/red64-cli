/**
 * HookRunner - Hook runner extension point for workflow phase hooks.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * Responsibilities:
 * - Accept hook registrations for pre/post-phase positions across all workflow phases
 * - Sort hooks by priority (ascending), then by registration order (stable sort)
 * - Execute pre-phase hooks sequentially with veto support
 * - Execute post-phase hooks sequentially (veto ignored)
 * - Pass read-only hook context to handlers
 * - Wrap handlers in try/catch with plugin attribution
 * - Enforce configurable timeout per handler
 */

import type {
  HookRegistration,
  HookContext,
  HookExecutionResult,
  HookError,
  HookRunnerService,
  WorkflowPhase,
} from '../types.js';
import type { PluginRegistryService } from '../PluginRegistry.js';

// ---------------------------------------------------------------------------
// Default timeout (30 seconds)
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface HookRunnerOptions {
  readonly registry: PluginRegistryService;
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
  readonly timeout?: number;
}

// ---------------------------------------------------------------------------
// Extended Service Interface (includes registerHook)
// ---------------------------------------------------------------------------

export interface HookRunnerExtendedService extends HookRunnerService {
  /**
   * Register a hook from a plugin
   */
  registerHook(pluginName: string, registration: HookRegistration): void;
}

// ---------------------------------------------------------------------------
// Default Logger
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op when not provided
};

// ---------------------------------------------------------------------------
// Timeout Promise Utility
// ---------------------------------------------------------------------------

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates a HookRunner service instance.
 *
 * The HookRunner is responsible for:
 * 1. Accepting hook registrations for workflow phases
 * 2. Executing hooks in priority order with stable sort
 * 3. Supporting veto mechanism for pre-phase hooks
 * 4. Error isolation with plugin attribution
 * 5. Timeout enforcement
 */
export function createHookRunner(
  options: HookRunnerOptions
): HookRunnerExtendedService {
  const {
    registry,
    logger = defaultLogger,
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  /**
   * Register a hook from a plugin.
   * Delegates storage to the registry.
   */
  function registerHook(
    pluginName: string,
    registration: HookRegistration
  ): void {
    registry.registerHook(pluginName, registration);
  }

  /**
   * Execute pre-phase hooks sequentially.
   * Supports veto mechanism - if a hook vetoes, stop execution.
   */
  async function runPrePhaseHooks(
    phase: WorkflowPhase,
    context: HookContext
  ): Promise<HookExecutionResult> {
    const hooks = registry.getHooks(phase, 'pre');
    const errors: HookError[] = [];
    let executedHooks = 0;

    for (const hook of hooks) {
      const { pluginName, registration } = hook;

      try {
        const resultPromise = registration.handler(context);
        const result = await withTimeout(
          resultPromise,
          timeout,
          `Hook from plugin "${pluginName}" timed out after ${timeout}ms`
        );

        executedHooks++;

        // Check for veto
        if (result.action === 'veto') {
          return {
            vetoed: true,
            vetoReason: result.reason,
            vetoPlugin: pluginName,
            executedHooks,
            errors,
          };
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        logger(
          'error',
          `[plugin:${pluginName}] Pre-phase hook failed: ${errorMessage}`
        );

        errors.push({
          pluginName,
          error: errorMessage,
        });

        // Count as executed even if it errored
        executedHooks++;
        // Continue to next hook (error isolation)
      }
    }

    return {
      vetoed: false,
      executedHooks,
      errors,
    };
  }

  /**
   * Execute post-phase hooks sequentially.
   * Veto is ignored in post-phase hooks - all hooks execute.
   */
  async function runPostPhaseHooks(
    phase: WorkflowPhase,
    context: HookContext
  ): Promise<HookExecutionResult> {
    const hooks = registry.getHooks(phase, 'post');
    const errors: HookError[] = [];
    let executedHooks = 0;

    for (const hook of hooks) {
      const { pluginName, registration } = hook;

      try {
        const resultPromise = registration.handler(context);
        await withTimeout(
          resultPromise,
          timeout,
          `Hook from plugin "${pluginName}" timed out after ${timeout}ms`
        );

        executedHooks++;
        // Ignore veto results for post-phase hooks
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        logger(
          'error',
          `[plugin:${pluginName}] Post-phase hook failed: ${errorMessage}`
        );

        errors.push({
          pluginName,
          error: errorMessage,
        });

        // Count as executed even if it errored
        executedHooks++;
        // Continue to next hook (error isolation)
      }
    }

    return {
      vetoed: false,
      executedHooks,
      errors,
    };
  }

  return {
    registerHook,
    runPrePhaseHooks,
    runPostPhaseHooks,
  };
}
