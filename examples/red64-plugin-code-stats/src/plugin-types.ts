/**
 * Plugin types for red64-cli
 *
 * These types mirror the official red64-cli plugin types.
 * External plugins would import these from 'red64-cli/plugins'.
 */

// ---------------------------------------------------------------------------
// Extension Point Types
// ---------------------------------------------------------------------------

export type ExtensionPointDeclaration =
  | 'commands'
  | 'agents'
  | 'hooks'
  | 'services'
  | 'templates';

export type HookPriority = 'earliest' | 'early' | 'normal' | 'late' | 'latest';

export type WorkflowPhase = 'requirements' | 'design' | 'tasks' | 'implementation';

export type AgentCapability =
  | 'code-generation'
  | 'code-review'
  | 'testing'
  | 'documentation'
  | 'refactoring';

export type TemplateCategory = 'stack' | 'spec' | 'steering';

// ---------------------------------------------------------------------------
// Command Types
// ---------------------------------------------------------------------------

export interface ArgumentDefinition {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface OptionDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'boolean' | 'number';
  readonly default?: string | boolean | number;
  readonly alias?: string;
}

export interface CommandArgs {
  readonly positional: readonly string[];
  readonly options: Readonly<Record<string, string | boolean | number>>;
  readonly context: PluginContextInterface;
}

export type CommandHandler = (args: CommandArgs) => Promise<void>;

export interface CommandRegistration {
  readonly name: string;
  readonly description: string;
  readonly args?: readonly ArgumentDefinition[];
  readonly options?: readonly OptionDefinition[];
  readonly handler: CommandHandler;
}

// ---------------------------------------------------------------------------
// Agent Types
// ---------------------------------------------------------------------------

export interface AgentAdapterInvokeOptions {
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly model?: string;
  readonly onOutput?: (chunk: string) => void;
  readonly onError?: (chunk: string) => void;
  readonly timeout?: number;
}

export interface AgentAdapterResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
}

export interface AgentAdapter {
  invoke(options: AgentAdapterInvokeOptions): Promise<AgentAdapterResult>;
  getCapabilities(): readonly AgentCapability[];
  configure(config: Readonly<Record<string, unknown>>): void;
}

export interface AgentRegistration {
  readonly name: string;
  readonly description: string;
  readonly adapter: AgentAdapter;
}

// ---------------------------------------------------------------------------
// Hook Types
// ---------------------------------------------------------------------------

export interface HookContext {
  readonly phase: WorkflowPhase;
  readonly timing: 'pre' | 'post';
  readonly feature: string;
  readonly specMetadata: Readonly<Record<string, unknown>>;
  readonly flowState: Readonly<Record<string, unknown>>;
}

export type HookHandlerResult =
  | { readonly action: 'continue' }
  | { readonly action: 'veto'; readonly reason: string };

export type HookHandler = (context: HookContext) => Promise<HookHandlerResult>;

export interface HookRegistration {
  readonly phase: WorkflowPhase | '*';
  readonly timing: 'pre' | 'post';
  readonly priority: HookPriority;
  readonly handler: HookHandler;
}

// ---------------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------------

export type ResolvedDependencies = Readonly<Record<string, unknown>>;

export type ServiceFactory = (resolved: ResolvedDependencies) => unknown;

export interface ServiceRegistration {
  readonly name: string;
  readonly factory: ServiceFactory;
  readonly dependencies?: readonly string[];
  readonly dispose?: () => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Template Types
// ---------------------------------------------------------------------------

export interface TemplateRegistration {
  readonly category: TemplateCategory;
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly subType?: 'requirements' | 'design' | 'tasks';
}

// ---------------------------------------------------------------------------
// Plugin Module Interface
// ---------------------------------------------------------------------------

export interface PluginModule {
  activate(context: PluginContextInterface): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Plugin Context Interface
// ---------------------------------------------------------------------------

export interface PluginContextInterface {
  readonly pluginName: string;
  readonly pluginVersion: string;
  readonly config: Readonly<Record<string, unknown>>;

  registerCommand(registration: CommandRegistration): void;
  registerAgent(registration: AgentRegistration): void;
  registerHook(registration: HookRegistration): void;
  registerService(registration: ServiceRegistration): void;
  registerTemplate(registration: TemplateRegistration): void;

  getService<T>(serviceName: string): T;
  hasService(serviceName: string): boolean;

  log(level: 'info' | 'warn' | 'error', message: string): void;

  getCLIVersion(): string;
  getProjectConfig(): Readonly<Record<string, unknown>> | null;
}
