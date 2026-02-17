# Gap Analysis: Plugin System

---
**Purpose**: Analyze the gap between requirements and existing codebase to inform implementation strategy decisions.

**Approach**:
- Provide analysis and options, not final implementation choices
- Offer multiple viable alternatives when applicable
- Flag unknowns and constraints explicitly
- Align with existing patterns and architecture limits
---

## Executive Summary

- **Scope**: 12 requirements covering plugin discovery/loading, manifest/metadata, lifecycle management, 5 extension points (commands, agents, hooks, services, templates), configuration, security/isolation, registry, and developer tooling -- a comprehensive plugin system for red64-cli.
- **Key Finding**: The existing codebase has **zero plugin infrastructure**. There are no plugin types, no plugin loader, no extension point registries, and no dynamic module loading. The codebase is entirely monolithic with hardcoded command routing, agent configuration, and service creation.
- **Primary Challenges**: (1) The CLI command routing is hardcoded via a React switch statement in `CommandRouter.tsx` with a fixed `Command` type union; extending this dynamically requires architectural changes. (2) The `AgentInvoker` has hardcoded `CodingAgent = 'claude' | 'gemini' | 'codex'` with static `AGENT_CLI_CONFIGS`; adding custom agents requires a registry pattern. (3) The workflow engine (`ExtendedFlowStateMachine`) has no hook/event system for pre/post-phase interception. (4) Services are created via individual factory functions with no service locator or DI container.
- **Recommended Approach**: Hybrid (Option C) -- create a new plugin subsystem (`src/plugins/`) while extending existing services with registration/extension points. This minimizes disruption to the working CLI while enabling the full plugin architecture.

## Current State Investigation

### Domain-Related Assets

| Category | Assets Found | Location | Notes |
|----------|--------------|----------|-------|
| CLI Entry Point | `cli.tsx`, `parseArgs.ts`, `validateFlags.ts` | `src/cli.tsx`, `src/cli/` | Hardcoded command set (`init`, `start`, `status`, `list`, `abort`, `mcp`, `help`) via `Command` type union |
| Command Routing | `CommandRouter.tsx` | `src/components/` | Static switch on `Command` type, maps to screen components |
| Agent System | `AgentInvoker.ts`, `AgentCliConfig` | `src/services/` | Hardcoded `CodingAgent` union type with static configs per agent |
| State Machine | `FlowStateMachine.ts`, `ExtendedFlowStateMachine.ts` | `src/services/` | Pure transition functions, no event emitter/hook system |
| State Store | `StateStore.ts` | `src/services/` | JSON file persistence in `.red64/flows/`, manages FlowState |
| Template System | `TemplateService.ts` | `src/services/` | Stack templates, framework installation, directory structure creation |
| Config System | `ConfigService.ts` | `src/services/` | Reads/writes `.red64/config.json`, stores `InitConfig` |
| Spec Init | `SpecInitService.ts` | `src/services/` | Creates spec directories with templates |
| Phase Executor | `PhaseExecutor.ts` | `src/services/` | Hardcoded prompt templates per phase, no hook system |
| UI Components | 15+ `.tsx` files | `src/components/ui/`, `src/components/screens/` | Ink-based terminal UI (React for CLI) |
| Type System | `types/index.ts`, `types/extended-flow.ts` | `src/types/` | Discriminated unions for phases, events, flow state |
| Service Index | `services/index.ts` | `src/services/` | Barrel export of all services, no registry pattern |

### Architecture Patterns

- **Dominant patterns**: Factory functions for services (`createAgentInvoker()`, `createStateStore()`, etc.), discriminated unions for state management, pure functions for state transitions, React (Ink) for terminal UI rendering.
- **Naming conventions**: `create*` for factory functions, `*Service` interface suffix, `*.ts` for services/types, `*.tsx` for components. Tests in `tests/` directory mirroring `src/` structure.
- **Dependency direction**: CLI entry -> CommandRouter -> Screen components -> Services. Services import types but do not import from components. No circular dependencies. No dependency injection container.
- **Module system**: ESM (`"type": "module"` in package.json), `.js` extensions in imports (TypeScript with ESM output), `tsc` for build.
- **Testing approach**: Vitest, tests in external `tests/` directory (not co-located), ink-testing-library for component tests. No tests currently exist in `src/`.

### Integration Surfaces

- **Data models/schemas**: `FlowState`, `FlowPhase`, `FlowEvent`, `CLIConfig`, `GlobalFlags`, `AgentInvokeOptions`, `AgentResult`, `InitConfig` -- all defined as TypeScript interfaces/types in `src/types/`.
- **Configuration storage**: `.red64/config.json` for project config, `.red64/flows/{feature}/state.json` for flow state, `.red64/specs/{feature}/spec.json` for spec metadata.
- **Agent CLI integration**: Spawns external CLI binaries (`claude`, `gemini`, `codex`) via `child_process.spawn()`.
- **Package ecosystem**: Published as npm package (`red64-cli`), uses `meow` for CLI parsing, `ink` for UI rendering.

## Requirements Feasibility Analysis

### Technical Needs (from Requirements)

| Requirement | Technical Need | Category | Complexity |
|-------------|----------------|----------|------------|
| R1: Plugin Discovery & Loading | Module scanner, manifest validator, dependency resolver, ESM dynamic import | Service / Logic | Complex |
| R2: Plugin Manifest & Metadata | JSON schema definition, version compatibility checker (semver), config schema support | Data Model / Logic | Moderate |
| R3: Plugin Lifecycle | `red64 plugin` command group (install/uninstall/enable/disable/list/update), npm registry interaction, rollback mechanism | CLI / Service | Complex |
| R4: Custom Commands | Dynamic command registration, command name conflict detection, context object for plugin commands | CLI / Service | Complex |
| R5: Custom Agents | Agent adapter interface, dynamic registration in AgentInvoker, capability declaration system | Service / Interface | Complex |
| R6: Workflow Hooks | Pre/post-phase hook registration, hook execution engine with priority ordering, veto mechanism, error isolation | Service / Logic | Complex |
| R7: Custom Services | Service registration API, service locator/container, lazy instantiation, disposal on uninstall | Service / Architecture | Moderate |
| R8: Custom Templates | Template namespacing, registration alongside built-in templates, integration with TemplateService | Service | Moderate |
| R9: Plugin Configuration | Config command, per-project config storage in `.red64/`, schema validation, merge with defaults | CLI / Service | Moderate |
| R10: Security & Isolation | Controlled API surface, error isolation, restricted access enforcement, module validation | Architecture / Security | Complex |
| R11: Plugin Registry | Search/info commands, registry client, custom registry URL support | CLI / Service | Moderate |
| R12: Plugin Development | Scaffold command, TypeScript type exports, dev mode with hot-reload, validation command | CLI / Dev Tooling | Moderate |

### Gap Analysis

| Requirement | Gap Type | Description | Impact |
|-------------|----------|-------------|--------|
| R1 | Missing | No plugin discovery, loading, or dynamic import infrastructure exists | High |
| R2 | Missing | No manifest schema, no version compatibility checking, no `semver` dependency | High |
| R3 | Missing | No `plugin` command group, no npm registry integration for plugins | High |
| R4 | Missing + Constraint | No dynamic command registration; `Command` type is a static union, `CommandRouter` is a hardcoded switch | High |
| R5 | Missing + Constraint | No agent adapter interface; `CodingAgent` is a static union, `AGENT_CLI_CONFIGS` is hardcoded | High |
| R6 | Missing | No hook/event system in PhaseExecutor or FlowStateMachine; workflow phases are driven by hardcoded prompt templates | High |
| R7 | Missing | No service registry/container; services are individually created via factory functions | Medium |
| R8 | Missing | TemplateService has no plugin-aware template registration; stacks are loaded from filesystem only | Medium |
| R9 | Missing | No plugin configuration storage or schema validation beyond existing `config.json` | Medium |
| R10 | Missing | No API surface control, no sandboxing, no module validation | High |
| R11 | Missing | No registry client, no search/info commands | Medium |
| R12 | Missing | No scaffold command, no public type package, no dev mode | Medium |

**Gap Types**:
- **Missing**: Capability does not exist in current codebase
- **Constraint**: Existing architecture limits implementation options (static type unions for commands/agents, hardcoded switch routing)

## Implementation Approach Options

### Option A: Extend Existing Components

**When to consider**: Feature fits naturally into existing structure

**Files/Modules to Extend**:

| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `src/types/index.ts` | Extend `Command` union, add plugin types | Breaking: requires updating all switch statements over `Command` |
| `src/types/index.ts` | Extend `CodingAgent` union | Breaking: hardcoded configs would need dynamic fallback |
| `src/cli/parseArgs.ts` | Add `plugin` to `VALID_COMMANDS`, handle subcommands | Moderate: subcommand parsing not currently supported |
| `src/components/CommandRouter.tsx` | Add `PluginScreen` case | Low: simple addition to switch |
| `src/services/AgentInvoker.ts` | Add dynamic agent config lookup | Moderate: currently uses static `Record<CodingAgent, AgentCliConfig>` |
| `src/services/PhaseExecutor.ts` | Add hook invocation around phase execution | Moderate: need to inject hook runner |
| `src/services/TemplateService.ts` | Add plugin template sources | Moderate: need to merge plugin templates with built-in |
| `src/services/ConfigService.ts` | Add plugin config read/write | Low: extend existing JSON operations |

**Trade-offs**:
- Minimal new files initially, leverages existing patterns
- Risk of bloating existing files significantly (especially `types/index.ts`)
- Hard to maintain clean plugin API boundary -- internal and plugin APIs intermingled
- Would require breaking type changes to static unions (`Command`, `CodingAgent`)
- Testing becomes harder as services grow in complexity

### Option B: Create New Components

**When to consider**: Feature has distinct responsibility or existing components are already complex

**New Components Required**:

| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `src/plugins/PluginLoader.ts` | Discover, validate, load plugins from npm/local | Reads `package.json`, uses dynamic `import()`, validates manifests |
| `src/plugins/PluginManager.ts` | Install, uninstall, enable, disable, update plugins | npm registry interaction, file operations, config updates |
| `src/plugins/PluginRegistry.ts` | Track loaded plugins, extension registrations | Central registry queried by services |
| `src/plugins/PluginContext.ts` | Controlled API surface for plugins | Wraps core services with restricted access |
| `src/plugins/PluginManifest.ts` | Manifest schema, validation, version checking | Zod or custom schema validation |
| `src/plugins/hooks/HookRunner.ts` | Execute pre/post-phase hooks with priority | Called by PhaseExecutor |
| `src/plugins/extensions/CommandExtension.ts` | Dynamic command registration | Feeds into CommandRouter |
| `src/plugins/extensions/AgentExtension.ts` | Agent adapter registration | Feeds into AgentInvoker |
| `src/plugins/extensions/ServiceExtension.ts` | Service registration with lazy init | Global service registry |
| `src/plugins/extensions/TemplateExtension.ts` | Plugin template registration | Feeds into TemplateService |
| `src/plugins/types.ts` | Plugin-specific type definitions | Exported as public API |
| `src/components/screens/PluginScreen.tsx` | UI for `red64 plugin` commands | Uses Ink components |

**Trade-offs**:
- Clean separation: plugin system is self-contained in `src/plugins/`
- Easier to test in isolation with mock registries
- Clear public API boundary for plugin developers
- More files to navigate, but well-organized
- Requires careful interface design at integration boundaries
- Existing services still need minor modifications to accept extensions

### Option C: Hybrid Approach (Recommended)

**When to consider**: Complex features requiring both extension and new creation

**Combination Strategy**:

| Part | Approach | Rationale |
|------|----------|-----------|
| Plugin core (`PluginLoader`, `PluginManager`, `PluginRegistry`, `PluginContext`, `PluginManifest`) | Create New | Entirely new domain, no existing code to extend |
| Extension points (`HookRunner`, `CommandExtension`, `AgentExtension`, `ServiceExtension`, `TemplateExtension`) | Create New | New abstractions that mediate between plugins and core |
| `CommandRouter.tsx` | Extend | Add dynamic command support alongside static routing |
| `AgentInvoker.ts` | Extend | Add fallback to plugin-registered agents when `CodingAgent` match fails |
| `PhaseExecutor.ts` | Extend | Inject hook runner before/after phase execution |
| `TemplateService.ts` | Extend | Add plugin template sources to listing and resolution |
| `ConfigService.ts` | Extend | Add plugin config section support |
| `parseArgs.ts` | Extend | Add `plugin` command with subcommand parsing |
| `types/index.ts` | Extend | Add `'plugin'` to Command union; keep `CodingAgent` static but add extension lookup |
| `PluginScreen.tsx` | Create New | New screen for plugin management UI |
| `plugins/types.ts` | Create New | Public plugin type definitions |

**Phased Implementation**:

Phase 1 (Foundation):
- Plugin types, manifest schema, loader, registry
- Plugin context with controlled API surface
- Basic `red64 plugin list` and `red64 plugin info` commands

Phase 2 (Extension Points):
- Command extension point (dynamic command registration)
- Agent extension point (custom agent adapters)
- Workflow hooks (pre/post-phase)

Phase 3 (Lifecycle & Services):
- Full lifecycle management (install/uninstall/enable/disable/update)
- Service extension point
- Template extension point
- Plugin configuration system

Phase 4 (Developer Experience):
- `red64 plugin create` scaffold
- Dev mode with hot-reload
- `red64 plugin validate` command
- Public type package / module exports

**Risk Mitigation**:
- Each phase is independently testable and deployable
- Core CLI functionality remains unaffected until extension points are wired in
- Feature flag (`plugins.enabled` in config) can gate plugin loading
- Rollback: simply don't load plugin registry if disabled

**Trade-offs**:
- Balanced approach: new code where needed, surgical modifications to existing code
- Allows iterative development and validation at each phase
- More complex planning required up front
- Integration testing needed at each phase boundary

## Effort and Risk Assessment

### Effort Estimate

| Option | Effort | Justification |
|--------|--------|---------------|
| A | L (1-2 weeks) | Scattered changes across many files, complex refactoring of type unions and switch statements, high coupling risk |
| B | XL (2+ weeks) | Full standalone plugin system plus all integration adapters, most comprehensive but largest scope |
| C | XL (2+ weeks) | Similar scope to B but phased; Phase 1-2 achievable in ~1 week each, full system in 3-4 weeks |

**Effort Scale**:
- **S** (1-3 days): Existing patterns, minimal dependencies, straightforward integration
- **M** (3-7 days): Some new patterns/integrations, moderate complexity
- **L** (1-2 weeks): Significant functionality, multiple integrations or workflows
- **XL** (2+ weeks): Architectural changes, unfamiliar tech, broad impact

### Risk Assessment

| Option | Risk | Justification |
|--------|------|---------------|
| A | High | Modifying core types (discriminated unions) risks regressions across CLI; no clear API boundary; difficult to revert |
| B | Medium | Clean separation reduces regression risk, but large upfront investment before any integration; may diverge from core patterns |
| C | Medium | Phased approach reduces blast radius; integration risks contained per phase; existing tests provide regression safety net |

**Risk Factors**:
- **High**: Modifying `Command` type union affects every switch/match in the codebase; agent type extension is similarly pervasive
- **Medium**: Dynamic `import()` for ESM plugin loading is well-documented but has edge cases with TypeScript compilation and module resolution
- **Research Needed**: npm registry API for plugin search/install; semver comparison library selection; hot-reload mechanism for dev mode

## Recommendations for Design Phase

### Preferred Approach

**Recommended Option**: C (Hybrid Approach)

**Rationale**:
- The plugin system is a fundamentally new capability that deserves its own module boundary (`src/plugins/`)
- However, the extension points must integrate with existing core services, requiring targeted modifications
- Phased delivery allows early validation of the architecture before building all 12 requirements
- The existing test suite (50+ test files) provides a regression safety net for modifications to core services

### Key Decisions Required

1. **Plugin manifest format**: Should plugins use a dedicated `red64-plugin.json` file, or a `red64` field in `package.json`? The requirements mention both options. Decision affects discovery and loading strategy.
2. **Service container pattern**: Should the project adopt a lightweight DI container (e.g., `tsyringe`, `awilix`) to support plugin service registration, or implement a simpler custom service registry? This affects the entire plugin context design.
3. **Dynamic command routing strategy**: Should `Command` type remain a static union with a special `'plugin'` + dynamic fallback mechanism, or should it become a fully dynamic string-based routing system? The first is safer but limits plugin command naming.
4. **Agent adapter interface design**: What methods must a custom agent adapter implement? The existing `AGENT_CLI_CONFIGS` structure (binary + buildArgs + envKeyName) may not be sufficient for non-CLI-based agent integrations (e.g., HTTP API-based agents).
5. **Plugin isolation model**: Process-level isolation (separate worker threads / child processes) vs. in-process with error boundaries? The requirements mention controlled API surface but not full sandboxing. Decision affects performance and security posture.
6. **npm vs. custom registry**: Should the plugin search/install use the standard npm registry with keyword-based discovery, or a custom red64-specific registry? The requirements support both but recommend configurable registry URL.

### Research Items to Carry Forward

| Item | Priority | Reason |
|------|----------|--------|
| ESM dynamic `import()` behavior with TypeScript-compiled modules | High | Plugins must be loaded dynamically at runtime; need to verify compatibility with `"module": "ESNext"` output and `.js` extension resolution |
| semver comparison library for Node.js | Medium | Required for R2 (version compatibility checking); candidates: `semver` npm package vs. Node.js built-in (none available natively) |
| npm programmatic API for plugin install/search | Medium | R3 and R11 require interacting with npm registry; options: spawn `npm` CLI vs. use `npm-registry-fetch` or `pacote` packages |
| Hot-reload mechanism for ESM modules in Node.js | Low | R12 requires dev mode hot-reload; Node.js native `--watch` flag vs. `chokidar` file watcher + module cache invalidation |
| Plugin error isolation techniques in Node.js | Medium | R10 requires error isolation; options: try/catch boundaries, `vm.Module` sandboxing, worker threads |
| Hook priority and ordering patterns in plugin systems | Medium | R6 requires deterministic hook execution with priority; research existing patterns (WordPress hooks, Fastify hooks, etc.) |

## Out of Scope

Items explicitly deferred to design phase:
- Detailed interface definitions for plugin types (PluginManifest, PluginContext, AgentAdapter, etc.)
- Concrete file/directory layout within `src/plugins/`
- Error message wording and UX flow for plugin management commands
- Migration strategy for existing configurations when plugins are introduced
- Performance benchmarks for plugin loading overhead
- Public API stability guarantees and versioning strategy for the plugin SDK
