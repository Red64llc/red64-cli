/**
 * Phase Executor service
 * Requirements: 1.1, 2.1-2.6
 */

import type { FlowPhase, GlobalFlags } from '../types/index.js';
import type { AgentInvokerService } from './AgentInvoker.js';
import type { StateStoreService } from './StateStore.js';

/**
 * Phase execution result
 * Requirements: 2.5 - Return success only when output is valid and complete
 */
export interface PhaseExecutionResult {
  readonly success: boolean;
  readonly output: string | undefined;
  readonly error: string | undefined;
}

/**
 * Phase executor service interface
 * Requirements: 2.1 - Execute phase-specific operations
 */
export interface PhaseExecutorService {
  execute(
    phase: FlowPhase,
    flags: GlobalFlags,
    workingDirectory: string
  ): Promise<PhaseExecutionResult>;
}

/**
 * Prompt templates for each generation phase
 * Requirements: 2.2 - Construct focused prompts for each generation task
 * Requirements: 8.3 - Use red64: prefix for slash commands
 */
const PHASE_PROMPTS: Record<string, string> = {
  'initializing': '/red64:spec-init "{feature}" "{description}"',
  'requirements-generating': '/red64:spec-requirements {feature}',
  'design-generating': '/red64:spec-design {feature}',
  'tasks-generating': '/red64:spec-tasks {feature}',
  'implementing': '/red64:spec-impl {feature}'
};

/**
 * Default retry configuration
 * Requirements: 2.6 - Configurable max retry count
 */
const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Check if phase requires agent invocation
 */
function isGenerationPhase(phase: FlowPhase): boolean {
  return [
    'initializing',
    'requirements-generating',
    'design-generating',
    'tasks-generating',
    'implementing'
  ].includes(phase.type);
}

/**
 * Build prompt for phase
 * Requirements: 2.2, 2.3 - Focused prompt without workflow state
 */
function buildPrompt(phase: FlowPhase): string {
  const template = PHASE_PROMPTS[phase.type];
  if (!template) {
    return '';
  }

  let prompt = template;

  // Replace feature placeholder
  if ('feature' in phase) {
    prompt = prompt.replace('{feature}', phase.feature);
  }

  // Replace description placeholder for initializing phase
  if (phase.type === 'initializing') {
    prompt = prompt.replace('{description}', phase.description);
  }

  return prompt;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create phase executor service
 * Requirements: 2.1 - Factory function for phase executor
 */
export function createPhaseExecutor(
  agentInvoker: AgentInvokerService,
  _stateStore: StateStoreService
): PhaseExecutorService {
  return {
    /**
     * Execute phase-specific operations
     * Requirements: 2.1-2.6 - Execute generation tasks with retry logic
     */
    async execute(
      phase: FlowPhase,
      flags: GlobalFlags,
      workingDirectory: string
    ): Promise<PhaseExecutionResult> {
      // Non-generation phases don't require agent invocation
      if (!isGenerationPhase(phase)) {
        return {
          success: true,
          output: undefined,
          error: undefined
        };
      }

      const prompt = buildPrompt(phase);
      if (!prompt) {
        return {
          success: true,
          output: undefined,
          error: undefined
        };
      }

      // Retry loop
      // Requirements: 2.6 - Implement retry logic in TypeScript
      for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
        const result = await agentInvoker.invoke({
          prompt,
          workingDirectory,
          skipPermissions: flags.skipPermissions,
          tier: flags.tier,
          agent: flags.agent
        });

        if (result.success) {
          // Requirements: 2.5 - Parse agent output after completion
          return {
            success: true,
            output: result.stdout,
            error: undefined
          };
        }

        // Last attempt failed
        if (attempt === DEFAULT_MAX_RETRIES) {
          return {
            success: false,
            output: result.stdout || undefined,
            error: `Agent failed after ${DEFAULT_MAX_RETRIES} retries: ${result.stderr}`
          };
        }

        // Wait before retry with exponential backoff
        await sleep(RETRY_DELAY_MS * attempt);
      }

      // Should not reach here, but TypeScript needs this
      return {
        success: false,
        output: undefined,
        error: 'Unexpected error in phase execution'
      };
    }
  };
}
