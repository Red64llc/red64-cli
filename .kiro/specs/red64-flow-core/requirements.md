# Requirements Document

## Project Description (Input)
Core workflow functionality for red64-cli including the start command, state machine implementation, greenfield/brownfield phases, implementation execution, and PR creation.

## Introduction
red64-flow-core implements the primary workflow commands: `red64 start` to initiate feature development flows, and the state machine that drives phase transitions. It covers git worktree isolation, greenfield and brownfield workflow phases, HITL approval gates, implementation task execution, and pull request creation.

**Dependency**: Requires red64-cli-scaffold (Ink framework, command routing, UI components, AgentInvoker).

## Requirements

### Requirement 1: Start Command Flow
**Objective:** As a developer, I want to start a new feature flow that creates an isolated git worktree and runs the complete spec workflow, so that I can develop features in isolation with proper traceability.

#### Acceptance Criteria
1. When start command is invoked, the CLI shall validate that feature name is lowercase, starts with a letter, and contains only letters, numbers, and hyphens.
2. If feature name is invalid, the CLI shall display an error message with valid format examples.
3. When start command is invoked, the CLI shall check for existing worktree and prompt user if one exists.
4. When start command proceeds, the CLI shall create a new git worktree at `worktrees/<feature>` with branch `feature/<feature>`.
5. The CLI shall create and maintain a flow-state.json file in `.red64/specs/<feature>/` to track progress.
6. The CLI shall commit changes at each phase for traceability.

### Requirement 2: State Machine Implementation
**Objective:** As a developer, I want the workflow to be driven by a well-defined state machine, so that phase transitions are explicit, testable, and debuggable.

#### Acceptance Criteria
1. The red64-cli shall define workflow phases as TypeScript enum or union type (e.g., `init | requirements | requirements-approval | design | ...`).
2. The red64-cli shall implement a state transition function that maps current state and events to next state.
3. The red64-cli shall persist current phase to flow-state.json after each transition.
4. The red64-cli shall validate state transitions; invalid transitions shall result in error, not undefined behavior.
5. The red64-cli shall support both greenfield and brownfield phase sequences as configurable state machine variants.
6. The red64-cli shall emit state change events that UI components can subscribe to for rendering updates.

### Requirement 3: Workflow Phases - Greenfield
**Objective:** As a developer working on a new project, I want the greenfield workflow to guide me through requirements, design, tasks, and implementation, so that I can develop features systematically.

#### Acceptance Criteria
1. The CLI shall execute greenfield phases in order: init, requirements, requirements-approval, design, design-approval, tasks, tasks-approval, implementation, validation, pr, merge.
2. After requirements generation, the CLI shall transition to requirements-approval state and render approval UI.
3. After design generation, the CLI shall transition to design-approval state and render approval UI.
4. After tasks generation, the CLI shall transition to tasks-approval state and render approval UI.
5. If user approves at any approval gate, the CLI shall transition to the next generation phase.
6. If user requests changes at any approval gate, the CLI shall allow modifications and re-enter the approval state.
7. If user aborts at any approval gate, the CLI shall transition to cleanup state and exit gracefully.

### Requirement 4: Workflow Phases - Brownfield
**Objective:** As a developer working on an existing codebase, I want additional validation phases to ensure the new feature integrates properly, so that I can avoid breaking existing functionality.

#### Acceptance Criteria
1. When brownfield mode is active, the CLI shall include gap-analysis phase after requirements-approval.
2. When brownfield mode is active, the CLI shall include design-validation phase after design-approval.
3. After gap analysis, the CLI shall transition to gap-review state and display findings UI.
4. After design validation, the CLI shall transition to design-validation-review state and display findings UI.
5. The CLI shall allow user to transition back to earlier phases based on validation findings.

### Requirement 5: Implementation Phase
**Objective:** As a developer, I want the implementation phase to execute tasks incrementally with progress tracking, so that I can monitor and control the implementation process.

#### Acceptance Criteria
1. The CLI shall parse tasks.md to extract task list before starting implementation.
2. The CLI shall execute implementation tasks sequentially, invoking agent for each task.
3. The CLI shall commit after each task completion using TypeScript git operations.
4. The CLI shall display progress showing completed and remaining tasks.
5. While implementing, the CLI shall checkpoint every 3 tasks and render a continue/pause/abort prompt.
6. If user pauses implementation, the CLI shall persist current task index and transition to paused state.
7. The CLI shall create meaningful commit messages for each task (e.g., `feat(<feature>): implement task N - <summary>`).

### Requirement 6: Pull Request Creation
**Objective:** As a developer, I want the CLI to create a well-formatted PR with spec artifacts, so that reviewers have full context for the changes.

#### Acceptance Criteria
1. When creating a PR, the CLI shall push the feature branch using TypeScript git operations.
2. The CLI shall read and parse spec artifacts (requirements.md, design.md, tasks.md) to generate PR body.
3. The CLI shall create the PR using GitHub CLI (gh pr create) via TypeScript child process.
4. The CLI shall include links to spec artifacts in the PR description.
5. After PR creation, the CLI shall transition to merge-decision state and render merge options.
6. If user chooses to merge, the CLI shall squash-merge and delete the feature branch via TypeScript operations.
