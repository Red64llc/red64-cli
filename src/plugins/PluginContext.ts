/**
 * PluginContext - Scoped API surface for plugin code to interact with red64-cli.
 *
 * Requirements: 4.5, 6.3, 9.5, 10.1, 10.3
 *
 * Responsibilities:
 * - Expose a limited subset of core services to plugin code (read-only state access, service resolution, logging)
 * - Provide the plugin's resolved configuration (defaults merged with user overrides, frozen)
 * - Prevent direct access to internal implementation details (no filesystem access, no process control)
 * - Provide registration methods for each extension point (commands, agents, hooks, services, templates)
 * - Each plugin receives its own PluginContext instance scoped to its identity
 */

import type {
  PluginContextInterface,
  CommandRegistration,
  AgentRegistration,
  HookRegistration,
  ServiceRegistration,
  TemplateRegistration,
} from './types.js';
import type { PluginRegistryService } from './PluginRegistry.js';

// ---------------------------------------------------------------------------
// Factory Function Options
// ---------------------------------------------------------------------------

export interface PluginContextOptions {
  readonly pluginName: string;
  readonly pluginVersion: string;
  readonly config: Record<string, unknown>;
  readonly cliVersion: string;
  readonly projectConfig: Record<string, unknown> | null;
  readonly registry: PluginRegistryService;
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Deep Freeze Utility
// ---------------------------------------------------------------------------

/**
 * Deep freeze an object and all nested objects to make them truly read-only.
 * Returns the frozen object.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze the object itself first
  Object.freeze(obj);

  // Then recursively freeze all enumerable properties
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return obj as Readonly<T>;
}

// ---------------------------------------------------------------------------
// Default Logger (no-op)
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op logger when not provided
};

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates a scoped plugin context for a specific plugin.
 *
 * The context provides:
 * - Plugin identity (name, version)
 * - Read-only access to plugin configuration
 * - Extension registration methods (commands, agents, hooks, services, templates)
 * - Service resolution
 * - Logging utility with plugin attribution
 * - Read-only core access (CLI version, project config)
 *
 * The context does NOT provide:
 * - Filesystem access
 * - Process control
 * - Mutable core state
 */
export function createPluginContext(options: PluginContextOptions): PluginContextInterface {
  const {
    pluginName,
    pluginVersion,
    config,
    cliVersion,
    projectConfig,
    registry,
    logger = defaultLogger,
  } = options;

  // Freeze the config to make it read-only (Requirement 9.5)
  const frozenConfig = deepFreeze({ ...config }) as Readonly<Record<string, unknown>>;

  // Freeze the project config if it exists (Requirement 10.1)
  const frozenProjectConfig = projectConfig
    ? deepFreeze({ ...projectConfig }) as Readonly<Record<string, unknown>>
    : null;

  // ---------------------------------------------------------------------------
  // Extension Registration Methods
  // All registration methods delegate to the registry with automatic plugin attribution
  // ---------------------------------------------------------------------------

  function registerCommand(registration: CommandRegistration): void {
    registry.registerCommand(pluginName, registration);
  }

  function registerAgent(registration: AgentRegistration): void {
    registry.registerAgent(pluginName, registration);
  }

  function registerHook(registration: HookRegistration): void {
    registry.registerHook(pluginName, registration);
  }

  function registerService(registration: ServiceRegistration): void {
    registry.registerService(pluginName, registration);
  }

  function registerTemplate(registration: TemplateRegistration): void {
    registry.registerTemplate(pluginName, registration);
  }

  // ---------------------------------------------------------------------------
  // Service Resolution
  // ---------------------------------------------------------------------------

  function getService<T>(serviceName: string): T {
    return registry.resolveService<T>(serviceName);
  }

  function hasService(serviceName: string): boolean {
    return registry.hasService(serviceName);
  }

  // ---------------------------------------------------------------------------
  // Logging Utility
  // ---------------------------------------------------------------------------

  function log(level: 'info' | 'warn' | 'error', message: string): void {
    const prefixedMessage = `[plugin:${pluginName}] ${message}`;
    logger(level, prefixedMessage);
  }

  // ---------------------------------------------------------------------------
  // Read-Only Core Access
  // ---------------------------------------------------------------------------

  function getCLIVersion(): string {
    return cliVersion;
  }

  function getProjectConfig(): Readonly<Record<string, unknown>> | null {
    return frozenProjectConfig;
  }

  // ---------------------------------------------------------------------------
  // Return the Context Interface
  // ---------------------------------------------------------------------------

  // The context is the only bridge between plugin code and the system.
  // It exposes a controlled API surface and prevents access to filesystem,
  // process control, or mutable core state. (Requirements 10.1, 10.3)
  const context: PluginContextInterface = {
    // Plugin identity
    pluginName,
    pluginVersion,

    // Configuration (read-only, frozen)
    config: frozenConfig,

    // Extension registration
    registerCommand,
    registerAgent,
    registerHook,
    registerService,
    registerTemplate,

    // Service resolution
    getService,
    hasService,

    // Utilities
    log,

    // Read-only core access
    getCLIVersion,
    getProjectConfig,
  };

  return context;
}
