/**
 * CommandExtension - Command extension point for plugin-provided CLI commands.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * Responsibilities:
 * - Accept command registrations from plugins via the PluginContext
 * - Validate that command names do not conflict with core commands or other plugins
 * - Log conflict warnings and reject conflicting registrations
 * - Wrap command handler execution in try/catch with plugin attribution
 * - Provide lookup function for CommandRouter to resolve dynamic commands
 */

import type {
  CommandRegistration,
  CommandArgs,
  RegisteredCommand,
} from '../types.js';
import type { PluginRegistryService } from '../PluginRegistry.js';

// ---------------------------------------------------------------------------
// Core commands to protect from conflicts
// ---------------------------------------------------------------------------

const CORE_COMMANDS: ReadonlySet<string> = new Set([
  'init',
  'start',
  'status',
  'list',
  'abort',
  'mcp',
  'help',
  'plugin',
]);

// ---------------------------------------------------------------------------
// Command Execution Result
// ---------------------------------------------------------------------------

export interface CommandExecutionResult {
  readonly success: boolean;
  readonly pluginName?: string;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface CommandExtensionService {
  /**
   * Register a command from a plugin
   */
  registerCommand(pluginName: string, registration: CommandRegistration): void;

  /**
   * Execute a registered command by name
   */
  executeCommand(
    commandName: string,
    args: CommandArgs
  ): Promise<CommandExecutionResult>;

  /**
   * Look up a command by name (for CommandRouter)
   */
  getCommand(commandName: string): RegisteredCommand | undefined;

  /**
   * Get all registered plugin commands
   */
  getAllCommands(): readonly RegisteredCommand[];
}

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface CommandExtensionOptions {
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
 * Creates a CommandExtension service instance.
 *
 * The CommandExtension is responsible for:
 * 1. Accepting command registrations from plugins
 * 2. Validating against core and cross-plugin conflicts
 * 3. Wrapping handler execution with error boundaries
 * 4. Providing lookup for the CommandRouter
 */
export function createCommandExtension(
  options: CommandExtensionOptions
): CommandExtensionService {
  const { registry, logger = defaultLogger } = options;

  /**
   * Register a command from a plugin.
   * Validates conflicts and delegates storage to the registry.
   */
  function registerCommand(
    pluginName: string,
    registration: CommandRegistration
  ): void {
    const { name } = registration;

    // Check for conflict with core commands
    if (CORE_COMMANDS.has(name)) {
      const message = `Command "${name}" from plugin "${pluginName}" conflicts with core command. Core commands: ${Array.from(CORE_COMMANDS).join(', ')}`;
      logger('warn', message);
      throw new Error(message);
    }

    // Check for conflict with another plugin's command
    const existing = registry.getCommand(name);
    if (existing) {
      const message = `Command "${name}" from plugin "${pluginName}" conflicts with command from plugin "${existing.pluginName}"`;
      logger('warn', message);
      throw new Error(message);
    }

    // Delegate storage to the registry
    registry.registerCommand(pluginName, registration);
  }

  /**
   * Execute a registered command with error isolation.
   */
  async function executeCommand(
    commandName: string,
    args: CommandArgs
  ): Promise<CommandExecutionResult> {
    const command = registry.getCommand(commandName);

    if (!command) {
      return {
        success: false,
        error: `Command "${commandName}" not found`,
      };
    }

    const { pluginName, registration } = command;

    try {
      await registration.handler(args);

      return {
        success: true,
        pluginName,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      logger(
        'error',
        `[plugin:${pluginName}] Command "${commandName}" failed: ${errorMessage}`
      );

      return {
        success: false,
        pluginName,
        error: errorMessage,
      };
    }
  }

  /**
   * Look up a command by name.
   */
  function getCommand(commandName: string): RegisteredCommand | undefined {
    return registry.getCommand(commandName);
  }

  /**
   * Get all registered plugin commands.
   */
  function getAllCommands(): readonly RegisteredCommand[] {
    return registry.getAllCommands();
  }

  return {
    registerCommand,
    executeCommand,
    getCommand,
    getAllCommands,
  };
}
