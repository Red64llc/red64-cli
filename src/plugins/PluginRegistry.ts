/**
 * PluginRegistry - Central in-memory extension store for the plugin system.
 *
 * Requirements: 4.3, 5.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.4
 *
 * Responsibilities:
 * - Store loaded plugin metadata, module references, and activation timestamps
 * - Maintain typed maps for each extension category: commands, agents, hooks, services, templates
 * - Enforce name uniqueness on registration (reject conflicts with core names or other plugins)
 * - Support lazy service instantiation with factory functions
 * - Implement service dependency resolution with circular dependency detection
 * - Support deregistration including disposal of instantiated services
 * - Provide query methods for registered extensions
 * - Namespace plugin templates automatically
 */

import type {
  LoadedPlugin,
  PluginModule,
  RegisteredPlugin,
  RegisteredCommand,
  RegisteredAgent,
  RegisteredHook,
  RegisteredTemplate,
  CommandRegistration,
  AgentRegistration,
  HookRegistration,
  ServiceRegistration,
  TemplateRegistration,
  WorkflowPhase,
  TemplateCategory,
} from './types.js';
import { HOOK_PRIORITY_ORDER as HookPriorityOrder } from './types.js';

// ---------------------------------------------------------------------------
// Core command and agent names to protect from conflicts
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

const CORE_AGENTS: ReadonlySet<string> = new Set(['claude', 'gemini', 'codex']);

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface ServiceEntry {
  readonly pluginName: string;
  readonly registration: ServiceRegistration;
  instance: unknown | null;
  instantiated: boolean;
}

// ---------------------------------------------------------------------------
// PluginRegistry Service Interface
// ---------------------------------------------------------------------------

export interface PluginRegistryService {
  // Plugin management
  registerPlugin(plugin: LoadedPlugin, module: PluginModule): void;
  unregisterPlugin(name: string): Promise<void>;
  getPlugin(name: string): RegisteredPlugin | undefined;
  getAllPlugins(): readonly RegisteredPlugin[];

  // Command extensions
  registerCommand(pluginName: string, registration: CommandRegistration): void;
  getCommand(commandName: string): RegisteredCommand | undefined;
  getAllCommands(): readonly RegisteredCommand[];

  // Agent extensions
  registerAgent(pluginName: string, registration: AgentRegistration): void;
  getAgent(agentName: string): RegisteredAgent | undefined;
  getAllAgents(): readonly RegisteredAgent[];

  // Hook extensions
  registerHook(pluginName: string, registration: HookRegistration): void;
  getHooks(phase: WorkflowPhase | '*', timing: 'pre' | 'post'): readonly RegisteredHook[];

  // Service extensions
  registerService(pluginName: string, registration: ServiceRegistration): void;
  resolveService<T>(serviceName: string): T;
  hasService(serviceName: string): boolean;

  // Template extensions
  registerTemplate(pluginName: string, registration: TemplateRegistration): void;
  getTemplates(category: TemplateCategory): readonly RegisteredTemplate[];
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

export function createPluginRegistry(): PluginRegistryService {
  // ---------------------------------------------------------------------------
  // State Maps
  // ---------------------------------------------------------------------------

  const plugins = new Map<string, RegisteredPlugin>();
  const commands = new Map<string, RegisteredCommand>();
  const agents = new Map<string, RegisteredAgent>();
  const hooks: RegisteredHook[] = [];
  const services = new Map<string, ServiceEntry>();
  const templates: RegisteredTemplate[] = [];

  // Counter for stable hook ordering
  let hookRegistrationCounter = 0;

  // ---------------------------------------------------------------------------
  // Plugin Management
  // ---------------------------------------------------------------------------

  function registerPlugin(plugin: LoadedPlugin, module: PluginModule): void {
    const registeredPlugin: RegisteredPlugin = {
      name: plugin.name,
      version: plugin.version,
      manifest: plugin.manifest,
      module,
      activatedAt: new Date().toISOString(),
    };
    plugins.set(plugin.name, registeredPlugin);
  }

  async function unregisterPlugin(name: string): Promise<void> {
    const plugin = plugins.get(name);
    if (!plugin) {
      return; // No-op for non-existent plugin
    }

    // Dispose instantiated services for this plugin
    const servicesToDispose: ServiceEntry[] = [];
    for (const [serviceName, entry] of services.entries()) {
      if (entry.pluginName === name) {
        servicesToDispose.push(entry);
        services.delete(serviceName);
      }
    }

    // Call dispose on instantiated services (continue even if one fails)
    for (const entry of servicesToDispose) {
      if (entry.instantiated && entry.registration.dispose) {
        try {
          await entry.registration.dispose();
        } catch {
          // Log error but continue disposing other services
          // In production, this would log to stderr with plugin attribution
        }
      }
    }

    // Remove all commands belonging to this plugin
    for (const [cmdName, cmd] of commands.entries()) {
      if (cmd.pluginName === name) {
        commands.delete(cmdName);
      }
    }

    // Remove all agents belonging to this plugin
    for (const [agentName, agent] of agents.entries()) {
      if (agent.pluginName === name) {
        agents.delete(agentName);
      }
    }

    // Remove all hooks belonging to this plugin
    for (let i = hooks.length - 1; i >= 0; i--) {
      if (hooks[i]?.pluginName === name) {
        hooks.splice(i, 1);
      }
    }

    // Remove all templates belonging to this plugin
    for (let i = templates.length - 1; i >= 0; i--) {
      if (templates[i]?.pluginName === name) {
        templates.splice(i, 1);
      }
    }

    // Finally, remove the plugin itself
    plugins.delete(name);
  }

  function getPlugin(name: string): RegisteredPlugin | undefined {
    return plugins.get(name);
  }

  function getAllPlugins(): readonly RegisteredPlugin[] {
    return Array.from(plugins.values());
  }

  // ---------------------------------------------------------------------------
  // Command Extensions
  // ---------------------------------------------------------------------------

  function registerCommand(pluginName: string, registration: CommandRegistration): void {
    const { name } = registration;

    // Check for conflict with core commands
    if (CORE_COMMANDS.has(name)) {
      throw new Error(
        `Command "${name}" conflicts with core command. Core commands: ${Array.from(CORE_COMMANDS).join(', ')}`
      );
    }

    // Check for conflict with another plugin's command
    const existing = commands.get(name);
    if (existing) {
      throw new Error(
        `Command "${name}" conflicts with command from plugin "${existing.pluginName}"`
      );
    }

    commands.set(name, {
      pluginName,
      registration,
    });
  }

  function getCommand(commandName: string): RegisteredCommand | undefined {
    return commands.get(commandName);
  }

  function getAllCommands(): readonly RegisteredCommand[] {
    return Array.from(commands.values());
  }

  // ---------------------------------------------------------------------------
  // Agent Extensions
  // ---------------------------------------------------------------------------

  function registerAgent(pluginName: string, registration: AgentRegistration): void {
    const { name } = registration;

    // Check for conflict with core agents
    if (CORE_AGENTS.has(name)) {
      throw new Error(
        `Agent "${name}" conflicts with core agent. Core agents: ${Array.from(CORE_AGENTS).join(', ')}`
      );
    }

    // Check for conflict with another plugin's agent
    const existing = agents.get(name);
    if (existing) {
      throw new Error(
        `Agent "${name}" conflicts with agent from plugin "${existing.pluginName}"`
      );
    }

    agents.set(name, {
      pluginName,
      registration,
    });
  }

  function getAgent(agentName: string): RegisteredAgent | undefined {
    return agents.get(agentName);
  }

  function getAllAgents(): readonly RegisteredAgent[] {
    return Array.from(agents.values());
  }

  // ---------------------------------------------------------------------------
  // Hook Extensions
  // ---------------------------------------------------------------------------

  function registerHook(pluginName: string, registration: HookRegistration): void {
    const registeredHook: RegisteredHook = {
      pluginName,
      registration,
      registrationOrder: hookRegistrationCounter++,
    };
    hooks.push(registeredHook);
  }

  function getHooks(phase: WorkflowPhase | '*', timing: 'pre' | 'post'): readonly RegisteredHook[] {
    // Filter hooks by phase and timing
    let filtered: RegisteredHook[];

    if (phase === '*') {
      // Return all hooks with matching timing
      filtered = hooks.filter((h) => h.registration.timing === timing);
    } else {
      // Return hooks for specific phase or wildcard
      filtered = hooks.filter(
        (h) =>
          h.registration.timing === timing &&
          (h.registration.phase === phase || h.registration.phase === '*')
      );
    }

    // Sort by priority (ascending: earliest to latest), then by registration order (stable sort)
    return filtered.sort((a, b) => {
      const priorityA = HookPriorityOrder[a.registration.priority];
      const priorityB = HookPriorityOrder[b.registration.priority];

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Stable sort by registration order for equal priorities
      return a.registrationOrder - b.registrationOrder;
    });
  }

  // ---------------------------------------------------------------------------
  // Service Extensions
  // ---------------------------------------------------------------------------

  function registerService(pluginName: string, registration: ServiceRegistration): void {
    const { name } = registration;

    // Check for conflict with another plugin's service
    const existing = services.get(name);
    if (existing) {
      throw new Error(
        `Service "${name}" conflicts with service from plugin "${existing.pluginName}"`
      );
    }

    services.set(name, {
      pluginName,
      registration,
      instance: null,
      instantiated: false,
    });
  }

  function resolveService<T>(serviceName: string): T {
    // Track resolution path for circular dependency detection
    const resolutionStack: string[] = [];
    return resolveServiceInternal<T>(serviceName, resolutionStack);
  }

  function resolveServiceInternal<T>(serviceName: string, resolutionStack: string[]): T {
    const entry = services.get(serviceName);
    if (!entry) {
      throw new Error(`Service "${serviceName}" not found`);
    }

    // Check for circular dependency
    if (resolutionStack.includes(serviceName)) {
      const cycle = [...resolutionStack, serviceName].join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Return cached instance if already instantiated
    if (entry.instantiated) {
      return entry.instance as T;
    }

    // Add to resolution stack
    resolutionStack.push(serviceName);

    try {
      // Resolve dependencies first
      const resolvedDeps: Record<string, unknown> = {};
      const dependencies = entry.registration.dependencies ?? [];

      for (const depName of dependencies) {
        const depEntry = services.get(depName);
        if (!depEntry) {
          throw new Error(
            `Dependency "${depName}" not found for service "${serviceName}"`
          );
        }
        resolvedDeps[depName] = resolveServiceInternal(depName, resolutionStack);
      }

      // Call factory with resolved dependencies
      const instance = entry.registration.factory(resolvedDeps);

      // Cache the instance
      entry.instance = instance;
      entry.instantiated = true;

      return instance as T;
    } finally {
      // Remove from resolution stack
      resolutionStack.pop();
    }
  }

  function hasService(serviceName: string): boolean {
    return services.has(serviceName);
  }

  // ---------------------------------------------------------------------------
  // Template Extensions
  // ---------------------------------------------------------------------------

  function registerTemplate(pluginName: string, registration: TemplateRegistration): void {
    // Namespace the template as pluginName/templateName
    const namespacedName = `${pluginName}/${registration.name}`;

    templates.push({
      pluginName,
      namespacedName,
      registration,
    });
  }

  function getTemplates(category: TemplateCategory): readonly RegisteredTemplate[] {
    return templates.filter((t) => t.registration.category === category);
  }

  // ---------------------------------------------------------------------------
  // Return Service Interface
  // ---------------------------------------------------------------------------

  return {
    // Plugin management
    registerPlugin,
    unregisterPlugin,
    getPlugin,
    getAllPlugins,

    // Command extensions
    registerCommand,
    getCommand,
    getAllCommands,

    // Agent extensions
    registerAgent,
    getAgent,
    getAllAgents,

    // Hook extensions
    registerHook,
    getHooks,

    // Service extensions
    registerService,
    resolveService,
    hasService,

    // Template extensions
    registerTemplate,
    getTemplates,
  };
}
