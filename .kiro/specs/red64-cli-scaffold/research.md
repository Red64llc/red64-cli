# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `red64-cli-scaffold`
- **Discovery Scope**: New Feature (Greenfield)
- **Key Findings**:
  - Ink 5.x with @inkjs/ui 2.x provides comprehensive terminal UI components including Spinner, Select, ConfirmInput
  - meow 14.0.0 (September 2025) offers zero-dependency CLI argument parsing with full TypeScript support
  - Node.js child_process spawn() with pipe stdio is optimal for streaming Claude CLI output in real-time
  - XState-style state machine patterns align with deterministic orchestration requirements but lightweight custom FSM preferred for simplicity

## Research Log

### Ink Framework Ecosystem
- **Context**: Need to establish terminal UI foundation with React-like components
- **Sources Consulted**:
  - [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
  - [Ink UI Components](https://github.com/vadimdemedes/ink-ui)
  - [LogRocket Ink UI Guide](https://blog.logrocket.com/using-ink-ui-react-build-interactive-custom-clis/)
- **Findings**:
  - Ink 5.x is the current stable version with full TypeScript support
  - @inkjs/ui 2.0.0 provides production-ready components: Spinner, Select, ConfirmInput, ProgressBar, Badge, Alert
  - ink-select-input 6.2.0 for selection menus with keyboard navigation (823 dependents)
  - useInput hook for keyboard handling (arrow keys, q to quit, Enter for confirm)
  - useApp hook provides exit() for graceful shutdown
  - Box and Text are primitive layout/styling components
- **Implications**:
  - Use @inkjs/ui as primary component library for spinners, progress, and selection inputs
  - Box/Text for custom layouts; useInput for keyboard navigation
  - Graceful exit via useApp().exit() pattern

### CLI Argument Parsing
- **Context**: Need robust argument/flag parsing for red64 commands
- **Sources Consulted**:
  - [meow GitHub](https://github.com/sindresorhus/meow)
  - [meow npm Guide](https://generalistprogrammer.com/tutorials/meow-npm-package-guide)
- **Findings**:
  - meow 14.0.0 released September 2025 - latest stable
  - Zero dependencies, full TypeScript support
  - Requires `importMeta: import.meta` configuration
  - Supports string, boolean, number flag types
  - Built-in shortFlag, choices, isRequired, isMultiple
  - Returns structured object: input[], flags{}, showHelp(), showVersion()
- **Implications**:
  - meow is ideal for red64 CLI - lightweight, typed, zero deps
  - Define all flags (--skip-permissions, --brownfield, --greenfield, --tier) in flag definitions
  - Use choices for --tier validation if predefined tiers exist

### Child Process for Agent Invocation
- **Context**: Need to spawn Claude CLI as subprocess and capture output
- **Sources Consulted**:
  - [Node.js child_process Documentation](https://nodejs.org/api/child_process.html)
  - [DigitalOcean Child Process Guide](https://www.digitalocean.com/community/tutorials/how-to-launch-child-processes-in-node-js)
- **Findings**:
  - spawn() preferred over exec() for streaming large output
  - stdio: 'pipe' (default) enables stdout/stderr capture
  - Event-based: stdout.on('data'), stderr.on('data'), on('close')
  - Environment variables via options.env (for CLAUDE_CONFIG_DIR)
  - Graceful handling: distinguish error event (spawn failure) from stderr (command output)
- **Implications**:
  - Use spawn() for Claude CLI invocation
  - Stream stdout to UI in real-time
  - Capture stderr for error handling
  - Return typed result with exitCode, stdout, stderr

### State Machine Patterns
- **Context**: Deterministic workflow orchestration without LLM control
- **Sources Consulted**:
  - [XState GitHub](https://github.com/statelyai/xstate)
  - [Composable State Machines in TypeScript](https://medium.com/@MichaelVD/composable-state-machines-in-typescript-type-safe-predictable-and-testable-5e16574a6906)
  - [TypeScript Orchestration Guide](https://medium.com/@matthieumordrel/the-ultimate-guide-to-typescript-orchestration-temporal-vs-trigger-dev-vs-inngest-and-beyond-29e1147c8f2d)
- **Findings**:
  - XState provides full actor-based state management but adds complexity
  - Simple discriminated union + switch pattern sufficient for linear workflows
  - TypeScript FSM libraries (ts-fsm, @edium/fsm) are lightweight alternatives
  - Key principle: determinism requires explicit state/transition definitions
  - Workflow state must be serializable for persistence/resume
- **Implications**:
  - Implement lightweight custom FSM using discriminated unions
  - Define explicit FlowPhase type with all possible states
  - Transition function takes (currentState, event) returns nextState
  - State persisted as JSON in .red64/ directory

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Custom FSM | Lightweight discriminated union state machine | Simple, no deps, full type safety | Must implement persistence manually | Selected - aligns with minimal dependency philosophy |
| XState | Full actor-based orchestration | Rich features, visualization tools | Heavy dependency, learning curve | Overkill for linear phase workflow |
| Redux-like | Reducer pattern with actions | Familiar to React devs | Action boilerplate, no FSM guarantees | Not suited for workflow phases |

## Design Decisions

### Decision: Lightweight Custom FSM over XState
- **Context**: Deterministic orchestration requires predictable state transitions
- **Alternatives Considered**:
  1. XState - full-featured state machine library
  2. Custom FSM - discriminated unions with switch transitions
- **Selected Approach**: Custom TypeScript FSM with FlowPhase discriminated union
- **Rationale**: Zero dependencies, full type safety, simpler mental model for linear spec workflow
- **Trade-offs**: Must implement persistence; no visualization tools
- **Follow-up**: Consider XState if workflow complexity grows significantly

### Decision: meow over Commander/Yargs
- **Context**: CLI argument parsing for red64 commands
- **Alternatives Considered**:
  1. meow - lightweight, zero deps
  2. Commander - popular, feature-rich
  3. Yargs - extensive options
- **Selected Approach**: meow 14.0.0
- **Rationale**: Zero dependencies aligns with minimal footprint; TypeScript support; sufficient for red64 command structure
- **Trade-offs**: Less feature-rich than Commander for complex subcommand hierarchies
- **Follow-up**: None needed - command structure is flat

### Decision: @inkjs/ui as Primary UI Library
- **Context**: Terminal UI components for spinners, progress, selection
- **Alternatives Considered**:
  1. @inkjs/ui - official Ink component library
  2. ink-spinner + ink-select-input separately
  3. Custom components from scratch
- **Selected Approach**: @inkjs/ui 2.x with supplemental ink-select-input
- **Rationale**: Unified theming, maintained alongside Ink core, comprehensive component set
- **Trade-offs**: Bundle slightly larger than individual packages
- **Follow-up**: Evaluate theme customization for red64 branding

### Decision: spawn() over exec() for Agent Invocation
- **Context**: Invoking Claude CLI and capturing output
- **Alternatives Considered**:
  1. spawn() - streaming stdout/stderr
  2. exec() - buffered output
  3. execFile() - direct binary execution
- **Selected Approach**: spawn() with pipe stdio
- **Rationale**: Supports real-time output streaming to UI; handles large agent responses
- **Trade-offs**: More complex event handling than exec()
- **Follow-up**: Add timeout handling for long-running agent tasks

## Risks & Mitigations
- **Risk 1**: Ink rendering conflicts with Claude CLI output
  - Mitigation: Dedicated UI region for agent output; consider alternate screen buffer
- **Risk 2**: State persistence corruption during crash
  - Mitigation: Atomic write pattern (write temp, rename); validation on load
- **Risk 3**: Claude CLI version compatibility
  - Mitigation: Document minimum Claude CLI version; validate on startup

## References
- [Ink GitHub](https://github.com/vadimdemedes/ink) - Core terminal UI framework
- [Ink UI Components](https://github.com/vadimdemedes/ink-ui) - Official component library
- [meow CLI Helper](https://github.com/sindresorhus/meow) - Argument parsing
- [Node.js child_process](https://nodejs.org/api/child_process.html) - Subprocess spawning
- [XState](https://github.com/statelyai/xstate) - Reference for state machine patterns
- [TypeScript FSM Patterns](https://medium.com/@MichaelVD/composable-state-machines-in-typescript-type-safe-predictable-and-testable-5e16574a6906) - Architecture guidance
