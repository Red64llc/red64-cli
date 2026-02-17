# Research & Design Decisions

---
**Feature**: plugin-system
**Discovery Scope**: Complex Integration (New Feature + Existing System Extension)
**Key Findings**:
- ESM dynamic `import()` is production-ready for plugin loading; query-string cache busting enables dev-mode hot reload without native ESM cache API
- The `semver` npm package provides all version comparison functions needed for manifest compatibility checking; zero-dependency alternative is not viable
- Spawning `npm` CLI is simpler and more reliable than using `pacote` directly for plugin install/uninstall; `pacote` is suited for manifest resolution and registry search
---

## Research Log

### ESM Dynamic Import for Plugin Loading

- **Context**: Requirement 1.7 mandates ESM module support for plugin entry points. The existing codebase uses `"type": "module"` with `module: "ESNext"` TypeScript output. Plugins must be loaded at runtime from unknown paths.
- **Sources Consulted**: [Node.js ESM documentation](https://nodejs.org/api/esm.html), [Node.js Plugin Architecture with ES Modules](https://medium.com/codeelevation/node-js-plugin-architecture-build-your-own-plugin-system-with-es-modules-5b9a5df19884), [Dynamic import MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- **Findings**:
  - `await import(path)` works with absolute file paths and `file://` URLs in Node.js 20+
  - Dynamic import returns a module namespace object containing all named exports and `default`
  - TypeScript-compiled ESM plugins (.js output) are fully compatible with dynamic `import()`
  - The `moduleResolution: "bundler"` setting in the host project does not affect runtime `import()` behavior
  - ESM module cache is not directly invalidatable (unlike CommonJS `require.cache`)
- **Implications**: Plugin entry points must export a well-defined interface. The PluginLoader can use `import()` with absolute paths resolved from plugin directories or `node_modules`. Dev-mode hot reload requires the query-string cache busting pattern (`import(\`\${path}?t=\${Date.now()}\`)`).

### Semver Version Compatibility Checking

- **Context**: Requirement 2.3 mandates semver range notation for red64-cli compatibility. Need to validate that a plugin's declared range matches the running CLI version.
- **Sources Consulted**: [semver npm package](https://www.npmjs.com/package/semver), [GitHub node-semver](https://github.com/npm/node-semver)
- **Findings**:
  - The `semver` package (v7.x, latest) provides `satisfies(version, range)` for compatibility checking
  - Supports all standard range syntaxes: `^1.0.0`, `~1.0.0`, `>=1.0.0 <2.0.0`, `1.x`
  - Modular imports available (`import { satisfies } from 'semver'`) for tree-shaking
  - Package is stable, maintained by npm core team, ~50M weekly downloads
  - Zero-dependency, pure JavaScript
- **Implications**: Add `semver` as a production dependency. Use `satisfies()` in manifest validation to check plugin compatibility with the running red64-cli version. No native Node.js alternative exists.

### npm Programmatic API for Plugin Install/Search

- **Context**: Requirements 3.1 (install), 11.1 (search) require interacting with npm registry for plugin management.
- **Sources Consulted**: [pacote npm package](https://www.npmjs.com/pacote), [GitHub pacote](https://github.com/zkat/pacote)
- **Findings**:
  - **pacote** (v21.x): Programmatic npm package handler. Provides `manifest()`, `packument()`, `extract()`, and `tarball()` APIs. Used internally by npm CLI.
  - **Spawning `npm` CLI**: Simpler for install/uninstall operations. Handles dependency resolution, lockfile updates, and lifecycle scripts automatically. The codebase already uses `child_process.spawn()` extensively (AgentInvoker pattern).
  - **npm search API**: The registry endpoint `/-/v1/search?text=keywords:red64-plugin` returns matching packages. Can be fetched with native `fetch()` (Node.js 20+ built-in).
- **Implications**: Use `child_process.spawn('npm', [...])` for install/uninstall/update commands (consistent with existing AgentInvoker pattern). Use native `fetch()` for registry search and manifest resolution. Reserve `pacote` as an optional optimization for future phases if needed.

### Plugin Hook Priority and Ordering

- **Context**: Requirement 6.6 mandates deterministic hook execution order based on declared priority and plugin load order.
- **Sources Consulted**: [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/), [Fastify priorities issue](https://github.com/fastify/fastify/issues/4220), [WordPress hook priority analysis](https://seresa.io/blog/marketing-pixels-tags/the-wordpress-hook-priority-system-is-why-your-tracking-plugins-fight)
- **Findings**:
  - WordPress uses numeric priority (default 10); same-priority hooks execute in registration order
  - Fastify uses registration order only; priority feature was requested but not implemented natively
  - Custom plugin systems commonly use a named priority enum (e.g., `earliest`, `early`, `normal`, `late`, `latest`) mapped to numeric values for sorting
  - Deterministic ordering requires: (1) priority value, (2) stable sort by registration/load order for equal priorities
- **Implications**: Define a `HookPriority` enum with five levels. Sort hooks by priority (ascending), then by registration order (stable sort). Default priority is `normal`. This avoids the complexity of arbitrary numeric priorities while providing sufficient control.

### ESM Hot Reload for Dev Mode

- **Context**: Requirement 12.3 requires dev mode with hot-reload for locally linked plugins.
- **Sources Consulted**: [hot-esm npm](https://www.npmjs.com/package/hot-esm), [chokidar v5](https://github.com/paulmillr/chokidar), [ESM cache invalidation discussion](https://github.com/nodejs/help/issues/1399)
- **Findings**:
  - ESM does not expose a cache invalidation API like CommonJS `require.cache`
  - Workaround: append query string to import path (`import(\`\${path}?v=\${Date.now()}\`)`) to bypass cache
  - `chokidar` v5 (ESM-only, Node.js 20+) is the standard for cross-platform file watching
  - The query-string approach has a minor memory consideration: each import creates a new module entry in V8's internal cache. For dev mode with reasonable reload frequency, this is acceptable.
- **Implications**: Use chokidar v5 for file watching in dev mode. Use query-string cache busting for reimporting changed plugin modules. This is a dev-only feature and does not affect production plugin loading.

### Plugin Error Isolation Techniques

- **Context**: Requirement 10.2 mandates that unhandled exceptions in plugins do not crash the red64-cli process.
- **Sources Consulted**: Node.js `vm` module documentation, Node.js worker_threads documentation, existing red64-cli error handling patterns
- **Findings**:
  - **try/catch boundaries**: Simplest approach. Wrap all plugin API calls in try/catch. Sufficient for synchronous and async (Promise) errors. The codebase already uses this pattern in AgentInvoker error handling.
  - **vm.Module sandboxing**: Provides true code isolation with separate global contexts. However, it is experimental in Node.js 20+, has significant performance overhead, and complicates module resolution.
  - **Worker threads**: Full process-level isolation. Highest security but introduces IPC overhead, serialization constraints, and complexity. Overkill for a CLI tool where plugins run in the same trust domain as the CLI itself.
- **Implications**: Use try/catch error boundaries around all plugin API invocations (hook calls, command handlers, service factories, agent adapter calls). This matches the requirements (controlled API surface, error isolation) without introducing disproportionate complexity. Log errors with plugin attribution and continue execution.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks/Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Microkernel | Core app + plugin modules with controlled API surface | Clean separation, testable, extensible | Requires careful API boundary design | Aligns with gap analysis recommendation |
| Service Locator | Central registry for resolving services by name | Simple, no framework dependency | Can become opaque, harder to trace dependencies | Fits existing factory function pattern |
| DI Container | Full dependency injection (tsyringe, awilix) | Automatic resolution, lifecycle management | Heavy for CLI tool, requires decorators or additional config | Rejected: overkill for this project |
| Event-driven | Plugins communicate via event emitter | Loose coupling, async-friendly | Harder to debug, ordering challenges | Used selectively for hooks only |

**Selected**: Microkernel + Service Locator hybrid. The plugin subsystem acts as a microkernel providing a controlled API surface (PluginContext). Services are resolved through a lightweight service locator (PluginRegistry) using named registration. This avoids the weight of a full DI container while providing the extensibility needed.

## Design Decisions

### Decision: Plugin Manifest Format

- **Context**: Requirement 2.1 specifies two options: dedicated `red64-plugin.json` or a `red64` field in `package.json`. Gap analysis flagged this as a key decision.
- **Alternatives Considered**:
  1. Dedicated `red64-plugin.json` file in plugin root
  2. `red64` field in `package.json`
  3. Both supported (dual-source)
- **Selected Approach**: Dedicated `red64-plugin.json` file as the primary manifest, with optional `package.json` `red64-plugin` keyword for npm discovery.
- **Rationale**: A separate file keeps plugin metadata decoupled from npm package metadata. It avoids polluting `package.json` with red64-specific fields. It is easier to validate (standalone JSON schema) and easier for plugin scaffolding to generate. The `package.json` keyword is used only for npm-based discovery, not for manifest data.
- **Trade-offs**: Plugin developers must maintain two files (package.json for npm + red64-plugin.json for plugin metadata). This is mitigated by the `red64 plugin create` scaffold command.
- **Follow-up**: Define the Zod schema for manifest validation in implementation.

### Decision: Dynamic Command Routing Strategy

- **Context**: Requirement 4.1 requires registering plugin commands. The `Command` type is a static union and `CommandRouter` uses a hardcoded switch. Gap analysis identified this as a constraint.
- **Alternatives Considered**:
  1. Make `Command` fully dynamic (string-based routing)
  2. Keep `Command` static, add `'plugin'` entry, route plugin subcommands dynamically
  3. Maintain a separate dynamic command registry alongside the static router
- **Selected Approach**: Option 2 -- Add `'plugin'` to the `Command` union for the `red64 plugin` command group. For plugin-registered custom commands, add a fallback in `CommandRouter` that consults the `PluginRegistry` for dynamically registered commands.
- **Rationale**: Preserves type safety for core commands (no regressions). Plugin commands are namespaced (e.g., `red64 my-plugin:command`), so they do not conflict with core command names. The dynamic fallback is isolated to one code path in CommandRouter.
- **Trade-offs**: Plugin commands are not statically typed in the `Command` union. This is acceptable because plugin commands are user-defined and cannot be known at compile time.
- **Follow-up**: Define the command name conflict detection logic.

### Decision: Agent Adapter Interface Design

- **Context**: Requirement 5.2 requires defining an Agent Adapter interface. The existing `AGENT_CLI_CONFIGS` structure (binary + buildArgs) assumes CLI-based agents.
- **Alternatives Considered**:
  1. Extend `AgentCliConfig` with optional HTTP adapter fields
  2. Define a new abstract `AgentAdapter` interface independent of CLI execution
  3. Wrapper that converts `AgentAdapter` calls to the existing `AgentCliConfig` format
- **Selected Approach**: Option 2 -- Define a new `AgentAdapter` interface with `invoke()`, `getCapabilities()`, and `configure()` methods. The existing CLI-based agents can be wrapped with `CliAgentAdapter` that delegates to the current `AGENT_CLI_CONFIGS` pattern.
- **Rationale**: A generic interface supports both CLI-based agents (spawn external binary) and API-based agents (HTTP calls). The interface is not tied to the spawn pattern, enabling future agent types.
- **Trade-offs**: Existing built-in agents do not benefit from the adapter pattern directly (they continue using `AGENT_CLI_CONFIGS`). The adapter layer adds indirection but only for plugin-registered agents.
- **Follow-up**: Define the exact method signatures and error contract for `AgentAdapter`.

### Decision: Plugin Isolation Model

- **Context**: Requirement 10.1-10.5 requires security and isolation. Gap analysis listed process-level vs in-process isolation as a key decision.
- **Alternatives Considered**:
  1. Process-level isolation (worker threads / child processes)
  2. In-process with try/catch error boundaries and controlled API surface
  3. `vm.Module` sandboxing
- **Selected Approach**: Option 2 -- In-process execution with try/catch error boundaries, controlled API surface (PluginContext), and module entry point validation.
- **Rationale**: red64-cli is a developer tool where plugins are installed by the user (same trust model as npm packages). Full sandboxing is disproportionate to the threat model. Try/catch boundaries catch both sync and async errors. The PluginContext controls which services and APIs are exposed to plugins.
- **Trade-offs**: A malicious plugin could theoretically access Node.js globals. This is the same trust model as any npm package. The controlled API surface prevents accidental misuse, not intentional attacks.
- **Follow-up**: Document the plugin API contract clearly. Module validation checks that the entry point exports the expected interface.

### Decision: Service Registry Pattern

- **Context**: Requirement 7.1-7.6 requires service registration, resolution, and lifecycle management. Gap analysis identified that services are currently individual factory functions with no registry.
- **Alternatives Considered**:
  1. Full DI container (tsyringe, awilix)
  2. Custom lightweight service locator with Map-based registry
  3. No service container; rely on factory functions and module imports
- **Selected Approach**: Option 2 -- Custom lightweight service locator. A `Map<string, ServiceRegistration>` in the PluginRegistry holds service name, factory function, and metadata. Services are instantiated lazily on first resolution.
- **Rationale**: A full DI container is overkill for a CLI tool. The custom locator is simple, testable, and has zero external dependencies. Lazy instantiation avoids creating unused services. The registry can enforce name uniqueness to prevent core service conflicts.
- **Trade-offs**: No automatic dependency resolution (services must explicitly resolve their dependencies). This is acceptable given the relatively flat service dependency graph.
- **Follow-up**: Define the ServiceRegistration interface and disposal mechanism.

### Decision: Plugin Registry Source for Search/Install

- **Context**: Requirements 11.1-11.4 require plugin discovery and search via a registry.
- **Alternatives Considered**:
  1. Custom red64-specific registry server
  2. npm registry with keyword-based discovery (`red64-plugin` keyword)
  3. GitHub-based discovery
- **Selected Approach**: Option 2 -- Use the npm registry as the default plugin source. Plugins are regular npm packages tagged with `red64-plugin` keyword. Search uses the npm search API endpoint. A custom registry URL is configurable for organizations.
- **Rationale**: Leverages existing npm infrastructure (publishing, versioning, access control). Plugin developers already know npm workflows. No custom server to maintain. The configurable registry URL satisfies the organizational use case (requirement 11.3).
- **Trade-offs**: Discovery quality depends on npm search relevance. Plugin quality is not curated (any npm package with the keyword appears). Future curation can be added with a verified plugin list.
- **Follow-up**: Define the search API query format and response parsing.

## Risks & Mitigations

- **ESM cache leak in dev mode**: Query-string cache busting creates new module cache entries per reload. Mitigated by: dev mode is short-lived, Node.js garbage collects unreferenced module objects, and a warning is logged if reload count exceeds a threshold.
- **Plugin compatibility drift**: Plugins may break across red64-cli major versions. Mitigated by: semver compatibility checking in manifest (requirement 2.3), stable public API contract (requirement 10.4), deprecation warnings before API removal.
- **Hook execution performance**: Many plugins registering hooks could slow down phase transitions. Mitigated by: hooks run sequentially (not concurrently), hook timeout enforcement, early exit on veto, and priority-based ordering to run critical hooks first.
- **Circular plugin dependencies**: Plugins declaring dependencies on each other could cause infinite loops. Mitigated by: topological sort in PluginLoader with cycle detection.
- **npm CLI availability**: Plugin install/uninstall spawns `npm` CLI, which may not be in PATH. Mitigated by: check for `npm` binary availability at startup, provide actionable error message if missing, and support `--local-path` as a fallback.

## References

- [Node.js ESM documentation](https://nodejs.org/api/esm.html) -- Official ESM specification for module loading behavior
- [semver npm package](https://www.npmjs.com/package/semver) -- Version comparison library used for compatibility checking
- [pacote npm package](https://www.npmjs.com/pacote) -- Programmatic npm package handler for registry operations
- [Fastify Hooks documentation](https://fastify.dev/docs/latest/Reference/Hooks/) -- Reference for hook lifecycle patterns
- [chokidar v5](https://github.com/paulmillr/chokidar) -- Cross-platform file watching for dev mode hot reload
- [hot-esm package](https://www.npmjs.com/package/hot-esm) -- ESM hot reloading reference implementation
- [Node.js Plugin Architecture with ES Modules](https://medium.com/codeelevation/node-js-plugin-architecture-build-your-own-plugin-system-with-es-modules-5b9a5df19884) -- Pattern reference for ESM plugin systems
