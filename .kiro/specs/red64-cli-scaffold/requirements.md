# Requirements Document

## Project Description (Input)
Core CLI scaffold for red64-cli using Ink framework. Establishes the application architecture, command structure, terminal UI foundation, and agent invocation interface.

## Introduction
red64-cli-scaffold establishes the core infrastructure for the red64 CLI tool. This spec covers the Ink framework setup, deterministic orchestration architecture, command structure, terminal UI components, agent invocation interface, and branding. It provides the foundation upon which other specs (init, flow-core, flow-management) will build.

**Dependency**: This is the foundational spec. Other specs depend on this.

## Requirements

### Requirement 1: Deterministic Application-Level Orchestration
**Objective:** As a developer, I want the workflow orchestration to be deterministic and implemented in TypeScript, so that flow behavior is predictable and not dependent on LLM interpretation.

#### Acceptance Criteria
1. The red64-cli shall implement a TypeScript state machine that controls all phase transitions.
2. The red64-cli shall own all flow control logic; the agent shall never determine what phase executes next.
3. The red64-cli shall manage HITL approval gates as application-level UI states, not agent prompts.
4. The red64-cli shall execute git operations (worktree, commit, push, branch) directly via TypeScript, not through agent commands.
5. The red64-cli shall persist and restore flow state through TypeScript file I/O, not agent file operations.
6. The red64-cli shall implement error recovery and retry logic as deterministic TypeScript code paths.
7. When resuming a flow, the red64-cli shall compute the next phase from persisted state using TypeScript logic, not by asking the agent to interpret state.

### Requirement 2: Scoped Agent Invocation
**Objective:** As a developer, I want Claude/agent to be invoked only for specific generation tasks, so that AI capabilities are used for content generation without controlling workflow.

#### Acceptance Criteria
1. The red64-cli shall invoke Claude CLI only for discrete generation tasks: spec-init, spec-requirements, spec-design, spec-tasks, spec-impl, and validation commands.
2. When invoking Claude CLI, the red64-cli shall provide a focused prompt for the specific generation task only.
3. The red64-cli shall not pass workflow state or "next step" instructions to the agent.
4. The red64-cli shall wait for agent task completion, then resume control in TypeScript code.
5. The red64-cli shall parse and validate agent output before proceeding to the next phase.
6. If agent output is invalid or incomplete, the red64-cli shall handle retry/recovery in TypeScript, not by asking the agent to fix itself.

### Requirement 3: CLI Application Bootstrap
**Objective:** As a developer, I want to install and run red64-cli as a standalone command-line tool, so that I can orchestrate spec-driven development workflows from my terminal.

#### Acceptance Criteria
1. The red64-cli shall be installable via npm as a global or local package.
2. When red64-cli is invoked without arguments, the CLI shall display a help menu with available commands.
3. The red64-cli shall use Ink framework for rendering terminal UI components.
4. The red64-cli shall use meow or similar library for parsing CLI arguments and flags.
5. The red64-cli shall support TypeScript for type-safe development.

### Requirement 4: Command Structure
**Objective:** As a developer, I want red64-cli to provide commands for project initialization and workflow management, so that I can bootstrap projects and manage feature development flows.

#### Acceptance Criteria
1. When user invokes `red64 init`, the CLI shall bootstrap the current project for red64 flows.
2. When user invokes `red64 start <feature> "<description>"`, the CLI shall initiate a new feature development flow.
3. When user invokes `red64 resume <feature>`, the CLI shall resume a paused or interrupted flow.
4. When user invokes `red64 status [feature]`, the CLI shall display the status of one or all active flows.
5. When user invokes `red64 list`, the CLI shall display a summary table of all active feature flows.
6. When user invokes `red64 abort <feature>`, the CLI shall abort and cleanup the specified flow.
7. When user invokes `red64 help` or `red64 --help`, the CLI shall display detailed usage information.

### Requirement 5: Global Options
**Objective:** As a developer, I want to configure red64-cli behavior through global options, so that I can customize the workflow execution.

#### Acceptance Criteria
1. When `--skip-permissions` or `-s` flag is provided, the CLI shall pass the flag to claude command invocations.
2. When `--brownfield` or `-b` flag is provided, the CLI shall enable brownfield mode with gap analysis and design validation phases.
3. When `--greenfield` or `-g` flag is provided, the CLI shall use greenfield mode (default).
4. When `--tier <name>` or `-t <name>` option is provided, the CLI shall use the specified Claude configuration directory.
5. If `--tier` is provided without a value, the CLI shall display an error message.

### Requirement 6: Terminal UI Components
**Objective:** As a developer, I want a polished terminal interface with clear visual feedback, so that I can understand the workflow state at a glance.

#### Acceptance Criteria
1. The CLI shall use color coding: green for success, red for errors, yellow for warnings/pending.
2. The CLI shall display spinners during async operations (e.g., git operations, agent invocations).
3. The CLI shall use box-drawing characters for headers and section separators.
4. The CLI shall display progress bars or task counts during implementation phase.
5. The CLI shall support keyboard navigation (e.g., arrow keys for menu selection, q to quit).
6. The CLI shall render approval gates as interactive selection menus using Ink components.

### Requirement 7: Agent Invocation Interface
**Objective:** As a developer, I want a clean interface for invoking Claude CLI from TypeScript, so that agent calls are consistent and manageable.

#### Acceptance Criteria
1. The CLI shall implement an AgentInvoker module that wraps Claude CLI execution.
2. The AgentInvoker shall spawn Claude CLI as a child process using Node.js child_process APIs.
3. The AgentInvoker shall pass the skip-permissions flag if configured.
4. The AgentInvoker shall set CLAUDE_CONFIG_DIR environment variable if tier is specified.
5. The AgentInvoker shall capture stdout/stderr and return them to the calling code.
6. The AgentInvoker shall return a typed result indicating success/failure and any output.
7. The CLI shall display agent output in a dedicated UI region during execution.

### Requirement 8: Branding and Naming
**Objective:** As a maintainer, I want all references to be branded as "red64" instead of "kiro", so that this is clearly a distinct standalone tool.

#### Acceptance Criteria
1. The CLI shall use "red64" as the command name and in all user-facing strings.
2. The CLI shall use `.red64/` as the unified directory for all framework files.
3. All Claude slash commands shall use the `red64:` prefix (e.g., `/red64:spec-init`, `/red64:steering`).
4. The CLI shall display "Red64 Flow Orchestrator" as the application title.
5. Help text and documentation shall reference "red64-cli" and "red64" consistently.
