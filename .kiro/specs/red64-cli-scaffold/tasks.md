# Implementation Plan

## Tasks

- [x] 1. Establish project foundation and type definitions
- [x] 1.1 (P) Initialize TypeScript project with Ink dependencies
  - Set up package.json with ESM module configuration
  - Install ink, react, meow, @inkjs/ui, and TypeScript dev dependencies
  - Configure tsconfig.json with JSX support and strict mode
  - Add tsx for TypeScript execution
  - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [x] 1.2 (P) Define core type system for flow orchestration
  - Create FlowPhase discriminated union covering all workflow states (idle, initializing, requirements-generating, requirements-review, design-generating, design-review, tasks-generating, tasks-review, implementing, complete, aborted, error)
  - Create FlowEvent discriminated union for all valid state transitions (START, RESUME, PHASE_COMPLETE, APPROVE, REJECT, ABORT, ERROR)
  - Define FlowState interface with feature, phase, timestamps, history, and metadata
  - Define Status type for UI states (pending, running, success, error, warning)
  - _Requirements: 1.1_

- [x] 1.3 (P) Define CLI configuration types
  - Create Command type union for all supported commands (init, start, resume, status, list, abort, help)
  - Create GlobalFlags interface with skipPermissions, brownfield, greenfield, tier, help, version
  - Create CLIConfig interface combining command, args, and flags
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4_

- [x] 1.4 (P) Define agent invocation types
  - Create AgentInvokeOptions interface with prompt, workingDirectory, skipPermissions, tier, callbacks, timeout
  - Create AgentResult interface with success, exitCode, stdout, stderr, timedOut
  - Define output callback types for streaming
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [x] 2. Implement CLI entry point and argument parsing
- [x] 2.1 Set up CLI entry point with meow argument parser
  - Create cli.tsx as executable entry with shebang
  - Configure meow with help text showing all commands and options
  - Parse command from input array (first positional argument)
  - Extract additional positional arguments for feature names and descriptions
  - Use "red64" branding in help text and application title
  - _Requirements: 3.2, 3.4, 4.7, 8.1, 8.4, 8.5_

- [x] 2.2 Implement global flag parsing and validation
  - Parse --skip-permissions/-s boolean flag
  - Parse --brownfield/-b and --greenfield/-g mutually exclusive flags with greenfield as default
  - Parse --tier/-t string option with validation for missing value
  - Display error and exit if --tier provided without value
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Build root application component
- [x] 3.1 Create App component with global context
  - Implement GlobalConfigProvider context for sharing CLI configuration
  - Create useGlobalConfig hook for accessing flags throughout component tree
  - Wrap children in error boundary to catch and display component errors gracefully
  - Implement graceful exit handling via useApp hook
  - _Requirements: 3.3_

- [x] 3.2 Implement command routing logic
  - Create CommandRouter component that maps command string to screen component
  - Route to appropriate screen based on parsed command (init, start, resume, status, list, abort, help)
  - Default to HelpScreen for undefined or unknown commands
  - Pass args and flags to each screen via props
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 4. Implement terminal UI components
- [x] 4.1 (P) Create Spinner component wrapper
  - Re-export Spinner from @inkjs/ui with consistent label prop interface
  - Apply "red64" styling conventions
  - _Requirements: 6.2_

- [x] 4.2 (P) Create StatusLine component with color coding
  - Implement status display using Text component with color prop
  - Map status values to colors: green (success), red (error), yellow (pending/warning), cyan (info)
  - Accept label, status, and optional message props
  - _Requirements: 6.1_

- [x] 4.3 (P) Create SelectMenu component for interactive selection
  - Wrap @inkjs/ui Select or ink-select-input for menu selection
  - Support keyboard navigation (arrow keys for selection, Enter to confirm)
  - Accept items array with label/value pairs and onSelect callback
  - Style for approval gate interactions
  - _Requirements: 6.5, 6.6_

- [x] 4.4 (P) Create OutputRegion component for agent output display
  - Implement scrollable text region using Box and Text
  - Accept lines array and optional maxHeight for viewport
  - Support real-time streaming updates as new lines arrive
  - Add optional title with box-drawing border
  - _Requirements: 7.7_

- [x] 4.5 (P) Create Header component with branding
  - Use Unicode box-drawing characters for bordered header
  - Display "Red64 Flow Orchestrator" as application title
  - Support optional subtitle for context
  - _Requirements: 6.3, 8.4_

- [x] 4.6 (P) Create ProgressBar component wrapper
  - Re-export ProgressBar from @inkjs/ui
  - Accept current, total, and label props
  - Display task counts during implementation phase
  - _Requirements: 6.4_

- [x] 5. Implement flow state machine
- [x] 5.1 Implement deterministic state transition function
  - Create pure transition function that takes current FlowPhase and FlowEvent, returns next FlowPhase
  - Define all valid transitions explicitly (no implicit state changes)
  - Reject invalid transitions by returning current phase or error phase
  - Never consult external systems for transition decisions
  - _Requirements: 1.1, 1.2, 1.7_

- [x] 5.2 Implement FlowMachineService interface
  - Create getPhase() method returning current FlowPhase
  - Create send(event) method that transitions and returns new phase
  - Create canTransition(event) method for validating transitions before attempting
  - Implement createFlowMachine factory function with optional initial phase
  - _Requirements: 1.1, 1.6_

- [x] 5.3 Implement HITL approval gates as state transitions
  - Map APPROVE event from review phases to generation/implementation phases
  - Map REJECT event from review phases back to previous generation phase
  - Ensure approval gates are UI-driven, not agent-prompted
  - _Requirements: 1.3_

- [x] 6. Implement state persistence
- [x] 6.1 Implement StateStore service for flow persistence
  - Create save() method that serializes FlowState to JSON
  - Write to .red64/flows/{feature}/state.json path structure
  - Use atomic write pattern (write to temp file, then rename)
  - Include timestamps (createdAt, updatedAt) in persisted state
  - _Requirements: 1.5, 8.2_

- [x] 6.2 Implement state restoration and validation
  - Create load(feature) method that reads and parses state JSON
  - Validate loaded state against FlowState schema
  - Reject corrupted or invalid state files gracefully
  - Return undefined for non-existent flows
  - _Requirements: 1.5, 1.7_

- [x] 6.3 Implement flow management operations
  - Create list() method returning all active flow states
  - Create delete(feature) method for cleanup on abort
  - Create exists(feature) method for quick existence check
  - Ensure .red64/flows directory is created if missing
  - _Requirements: 1.5, 8.2_

- [x] 7. Implement agent invocation interface
- [x] 7.1 Implement AgentInvoker service core
  - Create invoke() method that spawns Claude CLI as child process
  - Use spawn() with pipe stdio for streaming output
  - Capture stdout and stderr separately
  - Return typed AgentResult with success, exitCode, stdout, stderr
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [x] 7.2 Implement agent configuration options
  - Pass --skip-permissions flag to Claude CLI when configured
  - Set CLAUDE_CONFIG_DIR environment variable when tier is specified
  - Support timeout option with process termination on expiry
  - Mark timedOut flag in result when timeout occurs
  - _Requirements: 7.3, 7.4, 2.1_

- [x] 7.3 Implement real-time output streaming
  - Call onOutput callback for each stdout chunk received
  - Call onError callback for each stderr chunk received
  - Enable UI to display agent output as it streams
  - _Requirements: 7.7, 2.4_

- [x] 7.4 Implement abort capability
  - Create abort() method that terminates running agent process
  - Handle SIGTERM gracefully
  - Update result to indicate aborted state
  - _Requirements: 2.4, 2.6_

- [x] 8. Implement phase executor
- [x] 8.1 Create PhaseExecutor service
  - Create execute() method that runs phase-specific operations
  - Map each generating phase to appropriate agent invocation
  - Construct focused prompts for each generation task (spec-init, spec-requirements, spec-design, spec-tasks, spec-impl)
  - Never pass workflow state or next-step instructions to agent
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 8.2 Implement agent output validation
  - Parse agent output after completion
  - Validate expected artifacts exist (spec files created)
  - Return success only when output is valid and complete
  - _Requirements: 2.5_

- [x] 8.3 Implement retry and error recovery
  - Implement retry logic in TypeScript for failed agent invocations
  - Use configurable max retry count with exponential backoff
  - Return error result after max retries exhausted
  - Never ask agent to fix itself on failure
  - _Requirements: 2.6, 1.6_

- [x] 9. Implement screen components
- [x] 9.1 (P) Implement HelpScreen component
  - Display comprehensive usage information for all commands
  - Show global options with descriptions
  - Use Header component for branding
  - Apply consistent color scheme
  - _Requirements: 4.7, 8.5_

- [x] 9.2 (P) Implement InitScreen component shell
  - Accept args and flags from router
  - Display initialization progress with Spinner
  - Show success/failure status with StatusLine
  - Placeholder for actual init logic (deferred to red64-init spec)
  - _Requirements: 4.1_

- [x] 9.3 (P) Implement StartScreen component shell
  - Accept feature name and description from args
  - Validate required arguments are provided
  - Display flow creation progress
  - Initialize FlowStateMachine with START event
  - Placeholder for phase execution loop (deferred to red64-flow-core spec)
  - _Requirements: 4.2_

- [x] 9.4 (P) Implement ResumeScreen component shell
  - Accept feature name from args
  - Load persisted flow state via StateStore
  - Display error if flow not found
  - Resume FlowStateMachine from loaded phase
  - Compute next phase from persisted state using TypeScript logic
  - _Requirements: 4.3, 1.7_

- [x] 9.5 (P) Implement StatusScreen component shell
  - Accept optional feature name from args
  - Load flow state for specified feature or display all
  - Display current phase, timestamps, and progress
  - Show appropriate status colors
  - _Requirements: 4.4_

- [x] 9.6 (P) Implement ListScreen component shell
  - Load all active flows via StateStore.list()
  - Display summary table with feature names, phases, and timestamps
  - Handle empty state gracefully
  - _Requirements: 4.5_

- [x] 9.7 (P) Implement AbortScreen component shell
  - Accept feature name from args
  - Display confirmation prompt using SelectMenu
  - Trigger flow cleanup on confirmation
  - Delete flow state via StateStore
  - _Requirements: 4.6_

- [x] 10. Integration and wiring
- [x] 10.1 Connect App to CommandRouter and screens
  - Render CommandRouter as child of App
  - Pass parsed CLIConfig from meow to App component
  - Ensure all screens receive required props
  - _Requirements: 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 10.2 Wire FlowStateMachine with StateStore
  - Persist state changes after each transition
  - Load initial phase from StateStore on resume
  - Integrate history tracking into persisted state
  - _Requirements: 1.5, 1.7_

- [x] 10.3 Wire PhaseExecutor with AgentInvoker
  - Inject AgentInvoker dependency into PhaseExecutor
  - Connect output streaming to OutputRegion via callbacks
  - Validate agent output before signaling phase completion
  - _Requirements: 2.1, 2.4, 2.5, 7.7_

- [x] 10.4 Integrate git operations placeholder
  - Create git utility module with placeholder functions
  - Prepare interfaces for worktree, commit, push, branch operations
  - Ensure git operations will be executed directly via TypeScript (not agent)
  - Actual implementation deferred to red64-flow-core spec
  - _Requirements: 1.4_

- [x] 10.5 Verify slash command prefix alignment
  - Ensure all agent prompts reference red64: prefix for slash commands
  - Update prompt templates to use /red64:spec-init, /red64:steering, etc.
  - _Requirements: 8.3_

- [x] 11. End-to-end validation
- [x] 11.1 Validate CLI invocation without arguments displays help
  - Invoke red64 with no arguments
  - Verify help menu is displayed with available commands
  - Verify "Red64 Flow Orchestrator" title appears
  - _Requirements: 3.2, 8.4_

- [x] 11.2 Validate command routing for all commands
  - Test each command routes to correct screen component
  - Verify args and flags are passed correctly
  - Test unknown commands fall back to help
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 11.3 Validate global flag behavior
  - Test --skip-permissions flag is captured and passed to agent invocations
  - Test --brownfield and --greenfield mode flags
  - Test --tier validation with and without value
  - Verify error display when --tier lacks value
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11.4 Validate state persistence round-trip
  - Create flow state via start command
  - Persist to .red64/flows/{feature}/state.json
  - Resume and verify state matches
  - Delete and verify cleanup
  - _Requirements: 1.5, 1.7, 8.2_

- [x] 11.5 Validate branding consistency
  - Verify command name is "red64" throughout
  - Verify .red64/ directory structure is used
  - Verify help text references red64-cli consistently
  - _Requirements: 8.1, 8.2, 8.5_
