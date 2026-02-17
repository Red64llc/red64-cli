# Implementation Plan

- [ ] 1. Plugin type system and manifest schema
- [ ] 1.1 Define all plugin-related TypeScript types and interfaces
  - Define the PluginManifest, PluginModule, PluginDependency, ExtensionPointDeclaration, ConfigFieldSchema, and PluginState interfaces
  - Define extension point registration types: CommandRegistration, AgentRegistration, HookRegistration, ServiceRegistration, TemplateRegistration
  - Define result types: PluginLoadResult, ManifestValidationResult, CompatibilityResult, HookExecutionResult, InstallResult, UpdateResult
  - Define the HookPriority enum with five levels (earliest, early, normal, late, latest)
  - Define WorkflowPhase, HookContext, HookHandlerResult, AgentCapability, and TemplateCategory types
  - Define the PluginStateFile interface for persistent state storage
  - Export all types as a public module for plugin developers to consume
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 5.2, 5.4, 6.1, 6.3, 6.4, 6.6, 7.1, 8.4, 10.4, 12.2_

- [ ] 1.2 (P) Implement the manifest validation service using Zod
  - Create a Zod schema that validates all required manifest fields: name, version, description, author, entryPoint, red64CliVersion, extensionPoints
  - Support optional fields: dependencies (array of name+version), configSchema (record of typed fields with defaults)
  - Validate semver format for the version field and semver range for the red64CliVersion field using the semver package
  - Implement a compatibility check that compares a manifest's declared red64CliVersion range against the running CLI version
  - Return structured validation results with field-level error codes (MISSING_FIELD, INVALID_TYPE, INVALID_VALUE, SCHEMA_ERROR)
  - Provide both file-based validation (reads and parses JSON from a path) and data-based validation (accepts pre-parsed data)
  - Follow the factory function pattern (createManifestValidator) consistent with existing services
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.5, 2.6, 9.2, 12.4_

- [ ] 1.3 (P) Add new dependencies (zod, semver) and extend core type union
  - Add `zod` and `semver` as production dependencies in package.json
  - Add `chokidar` as a dev dependency for future dev mode support
  - Add `'plugin'` to the Command type union in the existing type system
  - Ensure all existing switch statements and pattern matches on Command are updated to handle the new case
  - _Requirements: 2.3, 4.1_

- [ ] 2. Plugin registry (in-memory extension store)
- [ ] 2.1 Implement the central plugin registry
  - Create a registry that stores loaded plugin metadata, module references, and activation timestamps
  - Maintain typed maps for each extension category: commands, agents, hooks, services, templates
  - Enforce name uniqueness on registration: reject if a command, agent, or service name collides with a core name or another plugin's registration
  - Support lazy service instantiation: store factory functions and resolve instances only on first access
  - Implement service dependency resolution: when resolving a service, first resolve its declared dependencies recursively
  - Detect circular service dependencies and throw a descriptive error
  - Support deregistration of all extensions belonging to a specific plugin, including disposal of instantiated services (call dispose if provided)
  - Provide query methods to look up registered commands, agents, hooks (filtered by phase and timing), services, and templates (filtered by category)
  - Namespace plugin templates automatically as `pluginName/templateName` on registration
  - Follow the factory function pattern (createPluginRegistry)
  - _Requirements: 4.3, 5.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.4_

- [ ] 3. Plugin context (controlled API surface)
- [ ] 3.1 Implement the scoped plugin context
  - Create a context object that is instantiated per plugin, scoped to the plugin's identity (name, version)
  - Provide registration methods that delegate to the plugin registry with automatic plugin attribution: registerCommand, registerAgent, registerHook, registerService, registerTemplate
  - Provide read-only access to the plugin's resolved configuration (defaults merged with user overrides, frozen)
  - Expose service resolution (getService, hasService) that delegates to the registry
  - Expose a logging utility that prefixes messages with `[plugin:<name>]`
  - Expose getCLIVersion and getProjectConfig as read-only accessors
  - Prevent access to filesystem, process control, or mutable core state; the context is the only bridge between plugin code and the system
  - Follow the factory function pattern (createPluginContext)
  - _Requirements: 4.5, 6.3, 9.5, 10.1, 10.3_

- [ ] 4. Plugin loader (discovery, validation, and activation)
- [ ] 4.1 Implement plugin source scanning and discovery
  - Scan configured plugin directories for subdirectories containing a `red64-plugin.json` manifest file
  - Scan `node_modules` for installed npm packages that have the `red64-plugin` keyword in their package.json
  - Support local directory paths as plugin sources without requiring npm publication
  - Collect discovered plugin paths and pass each to manifest validation
  - Log descriptive errors for unreadable directories or invalid JSON, and skip those plugins without affecting others
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 4.2 Implement dependency-aware loading order and activation
  - After validation, resolve inter-plugin dependencies using topological sort
  - Detect circular dependencies and report them as errors, skipping the cycle
  - Check red64-cli version compatibility for each plugin; refuse to load incompatible plugins with a version mismatch warning
  - Verify that all declared plugin dependencies are present and loaded before activating each plugin
  - Dynamically import each plugin's ESM entry point using `import()` with absolute file paths
  - Validate that the imported module exports the expected PluginModule interface (has an `activate` function) before executing any code
  - Call the plugin's `activate(context)` function with a scoped PluginContext, wrapped in a try/catch boundary
  - Register the activated plugin and its extensions in the plugin registry
  - Return a structured load result listing successfully loaded, skipped, and errored plugins
  - Follow the factory function pattern (createPluginLoader)
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 2.3, 2.4, 2.5, 10.2, 10.5_

- [ ] 5. Extension points
- [ ] 5.1 (P) Implement the command extension point
  - Accept command registrations from plugins via the PluginContext
  - Validate that the command name does not conflict with any core command (init, start, status, list, abort, mcp, help, plugin) or another plugin's command
  - Log a conflict warning and reject conflicting registrations
  - Wrap command handler execution in a try/catch boundary that catches errors, logs them with plugin attribution, and propagates a standardized error
  - Provide a lookup function for the CommandRouter to resolve dynamically registered commands by name
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.2 (P) Implement the agent extension point
  - Accept agent adapter registrations from plugins via the PluginContext
  - Validate that the agent name does not conflict with built-in agents (claude, gemini, codex) or other plugins
  - Wrap agent invocations in a try/catch boundary that catches errors, logs them with plugin attribution, and propagates a standardized error to the workflow engine
  - Expose a lookup function for the AgentInvoker to resolve custom agents
  - Support capability declaration so the workflow engine can query which operations a custom agent supports
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 5.3 (P) Implement the hook runner
  - Accept hook registrations for pre-phase and post-phase positions across all four workflow phases (requirements, design, tasks, implementation) plus a wildcard phase
  - Sort registered hooks by priority (ascending: earliest to latest), then by registration order for equal priorities (stable sort)
  - Execute pre-phase hooks sequentially; if any hook returns a veto result, record the veto reason and plugin name, and stop executing remaining hooks
  - Execute post-phase hooks sequentially; vetoing is not supported in post-phase hooks
  - Pass a read-only hook context containing the current phase, timing, feature name, spec metadata, and flow state
  - Wrap each hook handler invocation in a try/catch boundary; log errors with plugin attribution and continue to the next hook
  - Enforce a configurable timeout (default 30 seconds) per hook handler; treat timeouts as errors
  - Follow the factory function pattern (createHookRunner)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 5.4 (P) Implement the service extension point
  - Accept service registrations with a name, factory function, optional dependency list, and optional dispose function
  - Delegate storage to the plugin registry; enforce name uniqueness including core service names
  - Support lazy instantiation: factory is not called until first resolution
  - On service resolution, resolve declared dependencies first, then call the factory with the resolved dependencies
  - On plugin disable/uninstall, call the dispose function (if provided) for all instantiated services belonging to that plugin
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 5.5 (P) Implement the template extension point
  - Accept template registrations with a category (stack, spec, steering), name, description, and source path
  - Support a sub-type field for spec templates (requirements, design, or tasks)
  - Automatically namespace registered templates as `pluginName/templateName`
  - Provide query methods to list available plugin templates by category
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. Plugin manager (lifecycle operations)
- [ ] 6.1 Implement plugin install, uninstall, and update operations
  - Install plugins by spawning `npm install` with the package name or local path, using the existing child_process.spawn pattern
  - After npm install, locate and validate the plugin's manifest; if invalid, rollback by running `npm uninstall` and report the error
  - Uninstall plugins by first deregistering all extensions and disposing services, then spawning `npm uninstall`, then removing the plugin entry from the state file
  - Update plugins by fetching the latest compatible version, running `npm update`, and re-validating the manifest; preserve user configuration across updates
  - Implement rollback logic: if any step fails during install, undo filesystem and state changes to return to the previous state
  - Emit progress callbacks (downloading, validating, activating, complete) so the UI layer can display feedback
  - Check for npm CLI availability before operations; provide an actionable error if not found
  - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8_

- [ ] 6.2 Implement enable, disable, and list operations
  - Enable a plugin by setting its `enabled` flag to true in the state file; the plugin will load on next CLI invocation
  - Disable a plugin by setting its `enabled` flag to false and deregistering its extensions from the in-memory registry; warn if other plugins depend on it
  - List all installed plugins by reading the state file and enriching with manifest data: display name, version, enabled/disabled status, and declared extension points
  - Persist all state changes to `.red64/plugins.json` atomically
  - Follow the factory function pattern (createPluginManager)
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 6.3 Implement plugin configuration management
  - Provide a config command handler that reads or writes plugin-specific configuration values
  - Validate user-provided configuration values against the plugin's declared config schema from its manifest
  - Reject invalid values with a message describing the expected type or format
  - Store per-plugin configuration in `.red64/plugins/<plugin-name>/config.json`
  - When loading a plugin, merge declared defaults from the manifest with user-provided overrides, giving precedence to user values
  - Provide the merged configuration to the plugin via the PluginContext
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 7. Plugin registry and discovery (npm search)
- [ ] 7.1 Implement plugin search and info commands
  - Implement a search function that queries the npm registry search API endpoint (`/-/v1/search?text=keywords:red64-plugin+<query>`) using Node.js built-in fetch
  - Parse and return matching plugins with name, description, version, and author
  - Implement an info function that fetches detailed package metadata from the registry and combines it with local manifest data if the plugin is installed
  - Display the plugin's description, author, version, compatibility range, declared extension points, and configuration schema
  - Support configuring a custom plugin registry URL for organizations with private registries; store the URL in project configuration
  - Handle unreachable registry errors gracefully with an appropriate message suggesting network or configuration checks
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 8. Plugin developer tooling
- [ ] 8.1 (P) Implement the plugin scaffold command
  - When the user runs the create command, generate a new plugin project directory with the correct structure
  - Generate a `red64-plugin.json` manifest template pre-filled with the plugin name, a placeholder version, and an empty extension points list
  - Generate a `package.json` with the `red64-plugin` keyword, ESM module configuration, and a dependency on the red64-cli types package
  - Generate a TypeScript entry point file that exports a minimal PluginModule with activate and deactivate stubs
  - Generate a `tsconfig.json` configured for strict mode and ESM output
  - _Requirements: 12.1, 12.2_

- [ ] 8.2 (P) Implement the plugin validate command
  - Accept a local plugin directory path as input
  - Read the manifest file, validate it against the full Zod schema, check entry point existence, and verify type conformance of the exported module
  - Report all validation results: pass/fail for each check, with detailed error messages for failures
  - Do not load or activate the plugin during validation
  - _Requirements: 12.4_

- [ ] 8.3 Implement dev mode with hot reload
  - When dev mode is enabled and a local plugin path is provided, watch the plugin directory for file changes using chokidar
  - On file change, unload the plugin (deregister extensions, dispose services), then reload it using query-string cache busting (`import(\`\${path}?t=\${Date.now()}\`)`) to bypass ESM module cache
  - Log a warning if reload count exceeds a configurable threshold to indicate potential memory usage from module cache growth
  - Only watch the specific plugin directory being developed, not all installed plugins
  - _Requirements: 12.3_

- [ ] 9. Core service integration
- [ ] 9.1 Integrate plugin commands into the command router
  - Add a `'plugin'` case to the CommandRouter that renders the PluginScreen component for the `red64 plugin` command group
  - Add a dynamic fallback path in the CommandRouter that consults the plugin registry for unrecognized command names
  - When a dynamic command is found, delegate execution to the plugin's command handler with parsed arguments and a PluginContext
  - When no match is found in either static or dynamic routing, display the existing help/error message
  - _Requirements: 4.1, 4.4_

- [ ] 9.2 Integrate plugin agents into the AgentInvoker
  - Add a fallback lookup in the AgentInvoker that consults the plugin registry when the requested agent name does not match a built-in agent
  - When a custom agent is resolved, delegate invocation to the plugin's agent adapter using the standard AgentAdapter interface
  - Wrap the delegation in a try/catch boundary; catch errors, log with plugin attribution, and propagate a standardized AgentResult error
  - _Requirements: 5.1, 5.3, 5.5_

- [ ] 9.3 Integrate workflow hooks into the PhaseExecutor
  - Before executing any workflow phase, call the hook runner's runPrePhaseHooks with the current phase context
  - If a pre-phase hook vetoes the transition, abort the phase execution and propagate the veto reason to the caller
  - After successful phase execution, call the hook runner's runPostPhaseHooks
  - If no hooks are registered, the PhaseExecutor behaves identically to its current implementation
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ] 9.4 Integrate plugin templates into the TemplateService
  - When listing available templates, query the plugin registry for registered templates and merge them with built-in templates
  - When resolving a template by name, check for a namespaced plugin template (e.g., `plugin-name/template-name`) and resolve its source path through the registry
  - Apply plugin-provided templates using the same mechanism as built-in templates
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 9.5 Integrate plugin loading into the CLI startup sequence
  - After config loading but before command routing, read the plugin state file and call the plugin loader to discover and activate enabled plugins
  - Pass the current CLI version, configured plugin directories, and enabled plugin set to the loader
  - Log a summary of loaded, skipped, and errored plugins to stderr
  - Support a `plugins.enabled` config option (default: true) that, when set to false, skips all plugin loading
  - Wire the plugin registry, loader, manager, and hook runner into the CLI bootstrap so they are available to all downstream consumers
  - _Requirements: 1.1, 1.5, 1.6, 10.2_

- [ ] 10. Plugin management UI
- [ ] 10.1 Implement the PluginScreen component
  - Create an Ink-based terminal UI component following the existing screen pattern (similar to McpScreen, InitScreen)
  - Receive the plugin subcommand and arguments from the CommandRouter
  - Delegate all business logic to the PluginManager service
  - Render progress feedback (Spinner, status messages) during install and update operations
  - Render formatted tables for the list, search, and info subcommands
  - Render validation results for the validate subcommand
  - Render success/error messages for enable, disable, uninstall, config, and create subcommands
  - Support all eleven subcommands: install, uninstall, enable, disable, list, update, search, info, config, create, validate
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.1, 11.1, 11.2, 12.1, 12.4_

- [ ] 10.2 Extend argument parsing for the plugin command group
  - Add `plugin` to the set of valid commands in the argument parser
  - Parse the first positional argument after `plugin` as the subcommand (install, uninstall, enable, disable, list, update, search, info, config, create, validate)
  - Parse the remaining positional argument as the plugin name or path
  - Support relevant flags: `--registry` for custom registry URL, `--local-path` for local installs, `--dev` for dev mode
  - Pass the parsed subcommand, arguments, and options to the PluginScreen
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 9.1, 11.1, 11.2, 12.1, 12.4_

- [ ] 11. Testing
- [ ] 11.1 Unit tests for plugin core components
  - Test the manifest validator: valid manifests pass, missing required fields produce specific error codes, invalid semver ranges are rejected, config schema validation works, compatibility checking handles edge cases (pre-release versions, complex ranges)
  - Test the plugin registry: register/unregister plugins and extensions, name conflict detection for commands/agents/services, lazy service instantiation calls factory only on first resolve, service disposal on unregister, template namespacing
  - Test the hook runner: hooks execute in priority order (stable sort), veto mechanism stops pre-phase execution and records reason, post-phase hooks continue despite errors, timeout enforcement, error isolation logs and continues
  - Test the plugin context: registration methods delegate to registry with correct plugin attribution, config returns frozen object, restricted API does not expose internals
  - Test the command extension: conflict detection with core commands and cross-plugin conflicts
  - Test the agent extension: conflict detection with built-in agents, error wrapping with plugin attribution
  - Test the service extension: lazy instantiation, dependency resolution, circular dependency detection, disposal
  - Test the template extension: namespace generation, category filtering
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.5, 2.6, 4.3, 5.5, 6.4, 6.5, 6.6, 7.4, 7.5, 7.6, 10.1, 10.3_

- [ ] 11.2 Integration tests for plugin loading and lifecycle
  - Test loading a valid test plugin from a local directory: verify it activates, its extensions are registered, and the load result is correct
  - Test loading a directory with mixed valid and invalid plugins: verify partial success with correct skip/error reporting
  - Test the hook runner integrated with the PhaseExecutor: register pre-phase hooks, execute a phase, verify hooks are called in order and veto works
  - Test plugin install and uninstall end-to-end with a mock npm spawn
  - Test plugin enable/disable with state file persistence
  - Test config operations: set, get, validation against schema, merge with defaults
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 6.2, 6.4, 9.4, 9.6_

- [ ]*  11.3 Acceptance-criteria-focused test coverage for CLI commands
  - Test `red64 plugin list` with no plugins installed produces empty output
  - Test `red64 plugin validate` against a valid test plugin directory produces success message
  - Test `red64 plugin create` scaffolds a new plugin with the expected directory structure and manifest
  - Test `red64 plugin install` followed by `red64 plugin list` shows the installed plugin
  - Test `red64 plugin config` reads and writes plugin configuration correctly
  - Test `red64 plugin search` returns results from a mocked registry
  - _Requirements: 3.5, 3.6, 9.1, 11.1, 11.2, 12.1, 12.4_
