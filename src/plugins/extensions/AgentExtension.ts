/**
 * AgentExtension - Agent extension point for plugin-provided AI agent adapters.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * Responsibilities:
 * - Accept agent adapter registrations from plugins via the PluginContext
 * - Validate that agent names do not conflict with built-in agents or other plugins
 * - Wrap agent invocations in try/catch with plugin attribution
 * - Expose lookup function for AgentInvoker to resolve custom agents
 * - Support capability declaration for workflow engine queries
 */

import type {
  AgentRegistration,
  AgentAdapterInvokeOptions,
  AgentAdapterResult,
  AgentCapability,
  RegisteredAgent,
} from '../types.js';
import type { PluginRegistryService } from '../PluginRegistry.js';

// ---------------------------------------------------------------------------
// Built-in agents to protect from conflicts
// ---------------------------------------------------------------------------

const BUILTIN_AGENTS: ReadonlySet<string> = new Set([
  'claude',
  'gemini',
  'codex',
]);

// ---------------------------------------------------------------------------
// Agent Invocation Result
// ---------------------------------------------------------------------------

export interface AgentInvocationResult extends AgentAdapterResult {
  readonly pluginName?: string;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface AgentExtensionService {
  /**
   * Register an agent adapter from a plugin
   */
  registerAgent(pluginName: string, registration: AgentRegistration): void;

  /**
   * Invoke a registered agent by name
   */
  invokeAgent(
    agentName: string,
    options: AgentAdapterInvokeOptions
  ): Promise<AgentInvocationResult>;

  /**
   * Look up an agent by name (for AgentInvoker)
   */
  getAgent(agentName: string): RegisteredAgent | undefined;

  /**
   * Get the capabilities of a registered agent
   */
  getAgentCapabilities(agentName: string): readonly AgentCapability[];

  /**
   * Get all registered plugin agents
   */
  getAllAgents(): readonly RegisteredAgent[];
}

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface AgentExtensionOptions {
  readonly registry: PluginRegistryService;
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Default Logger
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op when not provided
};

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates an AgentExtension service instance.
 *
 * The AgentExtension is responsible for:
 * 1. Accepting agent adapter registrations from plugins
 * 2. Validating against built-in and cross-plugin conflicts
 * 3. Wrapping agent invocations with error boundaries
 * 4. Providing lookup for the AgentInvoker
 * 5. Exposing capability queries for the workflow engine
 */
export function createAgentExtension(
  options: AgentExtensionOptions
): AgentExtensionService {
  const { registry, logger = defaultLogger } = options;

  /**
   * Register an agent adapter from a plugin.
   * Validates conflicts and delegates storage to the registry.
   */
  function registerAgent(
    pluginName: string,
    registration: AgentRegistration
  ): void {
    const { name } = registration;

    // Check for conflict with built-in agents
    if (BUILTIN_AGENTS.has(name)) {
      const message = `Agent "${name}" from plugin "${pluginName}" conflicts with built-in agent. Built-in agents: ${Array.from(BUILTIN_AGENTS).join(', ')}`;
      logger('warn', message);
      throw new Error(message);
    }

    // Check for conflict with another plugin's agent
    const existing = registry.getAgent(name);
    if (existing) {
      const message = `Agent "${name}" from plugin "${pluginName}" conflicts with agent from plugin "${existing.pluginName}"`;
      logger('warn', message);
      throw new Error(message);
    }

    // Delegate storage to the registry
    registry.registerAgent(pluginName, registration);
  }

  /**
   * Invoke a registered agent with error isolation.
   */
  async function invokeAgent(
    agentName: string,
    options: AgentAdapterInvokeOptions
  ): Promise<AgentInvocationResult> {
    const agent = registry.getAgent(agentName);

    if (!agent) {
      return {
        success: false,
        output: '',
        error: `Agent "${agentName}" not found`,
      };
    }

    const { pluginName, registration } = agent;

    try {
      const result = await registration.adapter.invoke(options);

      return {
        ...result,
        pluginName,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      logger(
        'error',
        `[plugin:${pluginName}] Agent "${agentName}" invocation failed: ${errorMessage}`
      );

      return {
        success: false,
        output: '',
        pluginName,
        error: errorMessage,
      };
    }
  }

  /**
   * Look up an agent by name.
   */
  function getAgent(agentName: string): RegisteredAgent | undefined {
    return registry.getAgent(agentName);
  }

  /**
   * Get the capabilities of a registered agent.
   */
  function getAgentCapabilities(agentName: string): readonly AgentCapability[] {
    const agent = registry.getAgent(agentName);

    if (!agent) {
      return [];
    }

    return agent.registration.adapter.getCapabilities();
  }

  /**
   * Get all registered plugin agents.
   */
  function getAllAgents(): readonly RegisteredAgent[] {
    return registry.getAllAgents();
  }

  return {
    registerAgent,
    invokeAgent,
    getAgent,
    getAgentCapabilities,
    getAllAgents,
  };
}
