# Implementation Plan

## Task Overview

This plan implements core workflow functionality for red64-cli: the `start` command, extended state machine with greenfield/brownfield phases, implementation task execution with checkpoints, and PR creation.

---

## Tasks

- [x] 1. Implement feature validation and git worktree management
- [x] 1.1 (P) Create feature name validator service
  - Validate that feature names start with a lowercase letter and contain only lowercase letters, numbers, and hyphens
  - Return structured validation result with error message and format examples when validation fails
  - Implement as a pure function with no external dependencies
  - _Requirements: 1.1, 1.2_

- [x] 1.2 (P) Build worktree service for git worktree operations
  - Check if a worktree already exists for a given feature name using git worktree list command
  - Create new worktree at the designated path with a corresponding feature branch
  - Remove worktree with optional force flag for cleanup scenarios
  - List all existing worktrees with their paths and branch names
  - Parse git command output to extract worktree information
  - Handle git CLI errors gracefully with meaningful error messages
  - _Requirements: 1.3, 1.4_

- [x] 2. Extend state machine with greenfield and brownfield workflow phases
- [x] 2.1 Define extended flow phase types and events
  - Add brownfield-specific phases: gap-analysis, gap-review, design-validation, design-validation-review
  - Add implementation-related phases: implementing with task progress, paused with resume point
  - Add PR-related phases: pr, merge-decision, complete
  - Extend flow events to include task completion, PR creation, merge, and skip-merge events
  - Define workflow mode type for greenfield and brownfield distinction
  - Create phase sequence constants defining valid phase order for each workflow mode
  - _Requirements: 2.1, 2.5_

- [x] 2.2 Implement mode-aware state transition function
  - Extend existing transition function to handle new phases and events
  - Use workflow mode from state metadata to determine valid phase sequences
  - Validate that transitions follow the correct sequence for the active workflow mode
  - Return error state for invalid transitions rather than undefined behavior
  - Lock workflow mode at flow start to prevent mid-flow mode changes
  - _Requirements: 2.2, 2.4, 2.5_

- [x] 2.3 Add state persistence and event subscription for phase changes
  - Persist current phase to flow state after each transition
  - Implement subscription mechanism for UI components to receive phase change notifications
  - Ensure subscribers are notified synchronously after state updates
  - Provide unsubscribe function to prevent memory leaks
  - _Requirements: 2.3, 2.6_

- [x] 3. Implement commit service for git commit operations
- [x] 3.1 (P) Create commit service with stage and commit capabilities
  - Stage all changes in working directory using git add command
  - Create commit with provided message using git commit command
  - Handle empty working directory gracefully without error
  - Combine stage and commit into single atomic operation for convenience
  - Return commit hash on success for tracking purposes
  - Generate formatted commit messages following conventional commit pattern
  - _Requirements: 1.6, 5.3, 5.7_

- [x] 4. Build task parsing and execution system
- [x] 4.1 Create task parser to extract tasks from tasks.md
  - Read tasks.md file from the specification directory
  - Parse markdown to extract task identifiers, titles, and descriptions
  - Detect task completion status from checkbox markers
  - Return ordered array of tasks maintaining original sequence
  - Handle non-standard formats gracefully with warnings
  - _Requirements: 5.1_

- [x] 4.2 Implement task runner for incremental implementation execution
  - Execute tasks sequentially by invoking agent for each task
  - Track current task index and update progress after each completion
  - Commit changes after each successful task using commit service
  - Support starting from a specific task index for resume scenarios
  - Report progress to callback function for UI updates
  - Handle agent failures with retry logic and error reporting
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 4.3 Add checkpoint prompts and pause/abort capabilities
  - Trigger checkpoint prompt every 3 completed tasks
  - Support continue, pause, and abort decisions at checkpoints
  - Persist paused state with current task index for later resume
  - Allow abort at any point with clean state preservation
  - Generate meaningful progress information for checkpoint display
  - _Requirements: 5.5, 5.6, 5.7_

- [x] 5. Create PR creation and merge service
- [x] 5.1 Build PR creator service for GitHub CLI operations
  - Push feature branch to remote origin
  - Read specification artifacts to generate comprehensive PR body content
  - Create pull request using GitHub CLI with title, body, and base branch
  - Parse CLI output to extract PR URL and number
  - Handle authentication and CLI availability errors with helpful messages
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.2 Add merge functionality to PR creator service
  - Support squash merge using GitHub CLI merge command
  - Delete feature branch after successful merge
  - Return structured result with success status and any errors
  - Handle merge conflicts and protected branch errors gracefully
  - _Requirements: 6.5, 6.6_

- [x] 6. Implement start screen with full command workflow
- [x] 6.1 Build start screen component with validation and worktree flow
  - Display feature name input and validate in real-time
  - Show clear error messages with format examples when validation fails
  - Check for existing worktree and prompt user for action if found
  - Display spinner during async worktree creation
  - Provide visual feedback with color coding for success, error, and pending states
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 6.2 Integrate start screen with flow initialization
  - Create worktree and feature branch after successful validation
  - Initialize flow state machine with feature name and description
  - Set workflow mode based on user selection or detection
  - Persist initial flow state and transition to requirements-generating phase
  - Commit initial spec directory structure for traceability
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 7. Implement HITL approval screens for workflow gates
- [x] 7.1 (P) Create approval screen component for phase gates
  - Display artifact summary for current approval phase
  - Render selection menu with approve, request changes, and abort options
  - Support keyboard shortcuts for quick action selection
  - Transition to next generation phase on approval
  - Allow modifications and re-enter approval state on rejection
  - Handle abort with graceful cleanup and exit
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7.2 (P) Extend approval screen for brownfield validation phases
  - Display gap analysis findings with actionable summary
  - Display design validation results with integration warnings
  - Allow transition back to earlier phases based on validation findings
  - Support different UI layouts for gap review versus design validation review
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 8. Build progress screen for implementation phase
- [x] 8.1 Create progress screen with task tracking display
  - Show progress bar indicating completed and remaining tasks
  - Display current task title and index
  - Update display in real-time as tasks complete
  - Render checkpoint prompt as selection menu when triggered
  - Support continue, pause, and abort decisions from checkpoint prompt
  - _Requirements: 5.4, 5.5_

- [x] 9. Wire phase execution for greenfield workflow
- [x] 9.1 Connect phase executor to extended state machine
  - Extend phase-to-prompt mapping for all greenfield phases
  - Handle approval phase transitions based on user input
  - Trigger appropriate UI screen rendering for each phase
  - _Requirements: 3.1_

- [x] 9.2 Integrate implementation phase with task runner
  - Parse tasks on entry to implementing phase
  - Wire task runner to progress screen for status updates
  - Connect checkpoint decisions back to state machine for pause/abort
  - Transition to validation phase after all tasks complete
  - _Requirements: 3.1, 5.2, 5.4_

- [x] 10. Wire phase execution for brownfield workflow
- [x] 10.1 Add brownfield phase handling to phase executor
  - Insert gap-analysis phase after requirements approval
  - Insert design-validation phase after design approval
  - Connect gap review and design validation review screens to state machine
  - Enable backward transitions to earlier phases when validation surfaces issues
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 11. Implement PR phase and merge decision flow
- [x] 11.1 Connect PR phase to PR creator service
  - Push branch and create PR on entry to pr phase
  - Store PR URL and number in flow state metadata
  - Transition to merge-decision phase after PR creation
  - Display PR URL to user for review
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 11.2 Implement merge decision screen and actions
  - Render selection menu with merge and skip merge options
  - Execute squash merge and branch deletion on merge selection
  - Transition to complete phase after merge or skip
  - Display final completion status with summary
  - _Requirements: 6.5, 6.6_

- [x] 12. Add comprehensive test coverage
- [x] 12.1 (P) Write unit tests for validation and parsing services
  - Test feature validator with valid names, invalid patterns, and edge cases
  - Test task parser with standard format, missing tasks, and completion status variations
  - Test PR body generation with various artifact combinations
  - _Requirements: 1.1, 1.2, 5.1_

- [x] 12.2 (P) Write unit tests for state machine transitions
  - Test all greenfield phase transitions with valid events
  - Test all brownfield phase transitions with valid events
  - Test invalid transition rejection for both workflow modes
  - Verify mode locking behavior prevents mid-flow changes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 4.1, 4.2_

- [x] 12.3 Write integration tests for workflow flows
  - Test start command flow from validation through worktree creation to initialization
  - Test implementation phase from task parsing through execution to checkpoints
  - Test PR flow from push through creation to optional merge
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x]* 12.4 (P) Write component tests for UI screens using ink-testing-library
  - Test StartScreen validation display and error messages
  - Test ApprovalScreen selection menu navigation and keyboard shortcuts
  - Test ProgressScreen progress bar updates and checkpoint prompts
  - _Requirements: 1.1, 1.2, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.4, 5.5_
