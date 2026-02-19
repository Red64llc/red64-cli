# Requirements Document

## Project Description (Input)
implement a plugin system following this file: /Users/yacin/Workspace/lab/red64-cli/docs/red64-plugin-architecture.md

## Introduction

This document defines the requirements for a plugin system for red64-cli, a spec-driven development orchestrator for AI-assisted coding. The plugin system shall enable third-party developers to extend red64-cli's capabilities by adding custom commands, agents, workflow hooks, services, templates, and UI components. The system must integrate seamlessly with the existing architecture (CLI layer, services layer, framework, UI components, and type system) while maintaining security, stability, and version compatibility.

## Requirements

### Requirement 1: Plugin Discovery and Loading

**Objective:** As a plugin developer, I want red64-cli to discover and load plugins from multiple sources, so that plugins can be distributed via npm packages or used locally during development.

#### Acceptance Criteria
1. When red64-cli starts, the Plugin Loader shall scan configured plugin directories and resolve installed npm packages marked as red64 plugins.
2. When a local directory path is provided as a plugin source, the Plugin Loader shall load the plugin from that directory without requiring npm publication.
3. When an npm package with a `red64-plugin` keyword in its `package.json` is installed, the Plugin Loader shall recognize it as a valid plugin candidate.
4. The Plugin Loader shall validate each discovered plugin against a plugin manifest schema before attempting to load it.
5. If a plugin manifest is invalid or missing required fields, the Plugin Loader shall log a descriptive error and skip that plugin without affecting other plugins or core functionality.
6. When multiple plugins are discovered, the Plugin Loader shall load them in dependency-aware order, resolving inter-plugin dependencies before activation.
7. The Plugin Loader shall support ESM modules for plugin entry points, consistent with the existing red64-cli module system.

### Requirement 2: Plugin Manifest and Metadata

**Objective:** As a plugin developer, I want a standardized manifest format to declare my plugin's capabilities, so that red64-cli can understand what the plugin provides and how to integrate it.

#### Acceptance Criteria
1. The Plugin System shall require each plugin to provide a manifest file (e.g., `red64-plugin.json` or a dedicated field in `package.json`) declaring plugin name, version, description, author, and entry point.
2. The Plugin System shall require the manifest to declare which extension points the plugin uses (commands, agents, hooks, services, templates, or UI components).
3. The Plugin System shall require the manifest to specify the minimum compatible red64-cli version using semver range notation.
4. Where a plugin declares dependencies on other plugins, the Plugin System shall validate that all declared plugin dependencies are present and loaded before activating the dependent plugin.
5. If a plugin's declared red64-cli compatibility range does not match the running version, the Plugin System shall refuse to load that plugin and display a version mismatch warning.
6. The Plugin System shall support an optional `config` schema definition in the manifest, allowing plugins to declare their configuration options with types and default values.

### Requirement 3: Plugin Lifecycle Management

**Objective:** As a user, I want to install, enable, disable, and uninstall plugins, so that I can manage which extensions are active in my red64-cli environment.

#### Acceptance Criteria
1. When a user runs `red64 plugin install <name>`, the CLI shall download and install the specified plugin from the configured registry or local path.
2. When a user runs `red64 plugin uninstall <name>`, the CLI shall remove the plugin's files and deregister it from the plugin configuration.
3. When a user runs `red64 plugin enable <name>`, the CLI shall activate a previously disabled plugin for subsequent red64-cli sessions.
4. When a user runs `red64 plugin disable <name>`, the CLI shall deactivate the plugin without removing its files, preventing it from loading in subsequent sessions.
5. When a user runs `red64 plugin list`, the CLI shall display all installed plugins with their name, version, status (enabled/disabled), and declared extension points.
6. While a plugin is being installed, the CLI shall display progress feedback indicating download, validation, and activation steps.
7. If plugin installation fails at any step, the CLI shall roll back any partial changes and display an actionable error message.
8. When a user runs `red64 plugin update <name>`, the CLI shall fetch the latest compatible version and replace the existing plugin, preserving user configuration.

### Requirement 4: Custom Commands Extension Point

**Objective:** As a plugin developer, I want to register new CLI commands through my plugin, so that users can invoke plugin-specific functionality via the red64 command line.

#### Acceptance Criteria
1. When a plugin declares custom commands in its manifest, the Plugin System shall register those commands as subcommands available under the `red64` CLI.
2. The Plugin System shall provide a command registration API that accepts command name, description, argument definitions, option definitions, and a handler function.
3. If a plugin attempts to register a command name that conflicts with a core command or another plugin's command, the Plugin System shall reject the registration and log a conflict warning.
4. When a user invokes a plugin-provided command, the CLI shall delegate execution to the plugin's command handler with parsed arguments and options.
5. The Plugin System shall provide plugin commands access to core red64-cli services (e.g., StateStore, AgentInvoker) through a controlled context object.

### Requirement 5: Custom Agents Extension Point

**Objective:** As a plugin developer, I want to register custom agent adapters, so that red64-cli can orchestrate additional AI coding tools beyond the built-in Claude, Gemini, and Codex support.

#### Acceptance Criteria
1. When a plugin declares a custom agent in its manifest, the Plugin System shall register that agent as an available agent type in the AgentInvoker service.
2. The Plugin System shall define an Agent Adapter interface that custom agents must implement, including methods for invocation, capability querying, and configuration.
3. When a workflow phase requires agent invocation and a custom agent is selected, the AgentInvoker shall delegate to the plugin's agent adapter using the standard Agent Adapter interface.
4. The Plugin System shall allow custom agents to declare their supported capabilities (e.g., code generation, review, testing) so the workflow engine can select appropriate agents for each phase.
5. If a custom agent adapter throws an error during invocation, the Plugin System shall catch the error, log it with plugin attribution, and propagate a standardized error to the workflow engine.

### Requirement 6: Workflow Hooks Extension Point

**Objective:** As a plugin developer, I want to register hooks that execute before or after workflow phase transitions, so that plugins can augment or monitor the spec-driven development workflow.

#### Acceptance Criteria
1. The Plugin System shall provide pre-phase and post-phase hook registration points for each workflow phase (requirements, design, tasks, implementation).
2. When a workflow phase transition occurs, the Plugin System shall execute all registered pre-phase hooks before the phase begins and all registered post-phase hooks after the phase completes.
3. The Plugin System shall pass a read-only context object to hook handlers containing the current flow state, spec metadata, and phase-specific data.
4. While pre-phase hooks are executing, a hook shall be able to signal a veto to abort the phase transition by returning a rejection result with a reason.
5. If a hook handler throws an unhandled error, the Plugin System shall log the error with plugin attribution and continue executing remaining hooks without aborting the workflow.
6. The Plugin System shall execute hooks from different plugins in a deterministic order based on declared priority (default: normal priority) and plugin load order.

### Requirement 7: Custom Services Extension Point

**Objective:** As a plugin developer, I want to register custom services that integrate with the red64-cli services layer, so that plugins can provide reusable functionality accessible to other plugins and core features.

#### Acceptance Criteria
1. The Plugin System shall provide a service registration API that allows plugins to register named services with a factory function.
2. When a plugin registers a service, the Plugin System shall make it available to other plugins and core components through the service resolution mechanism.
3. The Plugin System shall support service dependency declaration so that plugin services can depend on core services or other plugin services.
4. If a registered service name conflicts with a core service name, the Plugin System shall reject the registration and log a conflict warning.
5. The Plugin System shall instantiate plugin services lazily, creating service instances only when first requested.
6. While a plugin is being disabled or uninstalled, the Plugin System shall gracefully dispose of any services registered by that plugin.

### Requirement 8: Custom Templates Extension Point

**Objective:** As a plugin developer, I want to provide custom spec templates, steering templates, and stack templates, so that users can use specialized project configurations provided by plugins.

#### Acceptance Criteria
1. When a plugin declares custom stack templates, the Plugin System shall register them alongside built-in stack templates and make them available during project initialization.
2. When a plugin declares custom spec templates (for requirements, design, or tasks), the Plugin System shall make them selectable as alternatives to the default templates.
3. When a plugin declares custom steering templates, the Plugin System shall allow users to apply them via the steering management workflow.
4. The Plugin System shall namespace plugin-provided templates to avoid naming conflicts (e.g., `plugin-name/template-name`).
5. When a user selects a plugin-provided template, the TemplateService shall resolve and apply it using the same mechanism as built-in templates.

### Requirement 9: Plugin Configuration

**Objective:** As a user, I want to configure plugin-specific settings, so that I can customize plugin behavior for my projects.

#### Acceptance Criteria
1. The Plugin System shall provide a `red64 plugin config <name> [key] [value]` command for viewing and setting plugin-specific configuration.
2. When a plugin declares a configuration schema in its manifest, the Plugin System shall validate user-provided configuration values against that schema.
3. If a user provides a configuration value that does not match the declared schema, the Plugin System shall reject the value and display the expected type or format.
4. The Plugin System shall store plugin configuration in the project's `.red64/` directory, allowing per-project plugin settings.
5. The Plugin System shall provide plugins access to their resolved configuration (user overrides merged with declared defaults) through the plugin context object.
6. When a plugin is loaded, the Plugin System shall merge default configuration from the manifest with any user-provided overrides, giving precedence to user values.

### Requirement 10: Security and Isolation

**Objective:** As a user, I want plugins to operate within defined boundaries, so that malicious or buggy plugins cannot compromise my system or interfere with core red64-cli functionality.

#### Acceptance Criteria
1. The Plugin System shall restrict plugin access to core services through a controlled API surface, preventing direct access to internal implementation details.
2. The Plugin System shall isolate plugin errors so that an unhandled exception in a plugin does not crash the red64-cli process.
3. If a plugin attempts to access a restricted API or perform an unauthorized operation, the Plugin System shall block the operation and log a security warning.
4. The Plugin System shall document the plugin API contract as a stable public API, clearly separating it from internal APIs that may change between versions.
5. While loading a plugin, the Plugin System shall verify the plugin's entry point is a valid module that exports the expected interface before executing any plugin code.

### Requirement 11: Plugin Registry and Information

**Objective:** As a user, I want to discover available plugins and view detailed information about them, so that I can find and evaluate plugins for my workflow.

#### Acceptance Criteria
1. When a user runs `red64 plugin search <query>`, the CLI shall query the configured plugin registry and display matching plugins with name, description, and version.
2. When a user runs `red64 plugin info <name>`, the CLI shall display detailed plugin metadata including description, author, version, compatibility range, declared extension points, and configuration schema.
3. The Plugin System shall support configuring a custom plugin registry URL for organizations that maintain private plugin collections.
4. If the plugin registry is unreachable, the CLI shall display an appropriate error message and suggest checking network connectivity or registry configuration.

### Requirement 12: Plugin Development Support

**Objective:** As a plugin developer, I want tooling and documentation support for creating plugins, so that I can efficiently build and test plugins for red64-cli.

#### Acceptance Criteria
1. When a user runs `red64 plugin create <name>`, the CLI shall scaffold a new plugin project with the correct directory structure, manifest template, and TypeScript configuration.
2. The Plugin System shall export TypeScript type definitions for all plugin interfaces, extension point contracts, and context objects as a public npm package or module.
3. The Plugin System shall support a development mode where a locally linked plugin is hot-reloaded when its source files change.
4. The Plugin System shall provide a plugin validation command (`red64 plugin validate <path>`) that checks a plugin's manifest, entry point, and type conformance without loading it into the runtime.

