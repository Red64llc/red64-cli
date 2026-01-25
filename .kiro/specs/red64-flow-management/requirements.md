# Requirements Document

## Project Description (Input)
Workflow management commands for red64-cli including resume, status, list, abort, and error handling.

## Introduction
red64-flow-management implements the workflow management commands: `red64 resume` to continue interrupted flows, `red64 status` and `red64 list` to view flow progress, and `red64 abort` to cleanup unwanted flows. It also covers error handling and recovery across all workflow operations.

**Dependency**: Requires red64-cli-scaffold (Ink framework, command routing, UI components) and red64-flow-core (state machine, flow-state.json).

## Requirements

### Requirement 1: Resume Command
**Objective:** As a developer, I want to resume an interrupted flow from exactly where it stopped, so that I do not lose progress or duplicate work.

#### Acceptance Criteria
1. When resume is invoked, the CLI shall read flow-state.json using TypeScript file I/O.
2. The CLI shall compute the resume point from persisted phase using TypeScript state machine logic.
3. If uncommitted changes exist in the worktree, the CLI shall render a prompt for user to commit, discard, or abort.
4. The CLI shall display current progress with checkmarks for completed phases.
5. The CLI shall re-enter the state machine at the persisted phase and continue execution.
6. If no worktree or flow-state exists for the feature, the CLI shall display an error message.

### Requirement 2: Status Command
**Objective:** As a developer, I want to view the detailed status of a specific flow, so that I can understand exactly where a feature is in the development process.

#### Acceptance Criteria
1. When status is invoked with a feature name, the CLI shall read flow-state.json and display detailed phase information.
2. The CLI shall display checkmarks for completed phases, circles for in-progress, and empty for pending.
3. The CLI shall display relative timestamps (e.g., "2 hours ago") for last updated times.
4. The CLI shall show PR status including PR number and merge state when applicable.
5. For implementation phase, the CLI shall display completed and remaining task counts.
6. If no flow exists for the feature, the CLI shall display an error message.

### Requirement 3: List Command
**Objective:** As a developer, I want to view all active flows at a glance, so that I can track progress across multiple features.

#### Acceptance Criteria
1. When list is invoked, the CLI shall scan worktrees directory for active flows.
2. The CLI shall read flow-state.json for each flow and extract summary information.
3. The CLI shall display a table with columns: Feature, Phase, Branch, Last Updated.
4. The CLI shall display relative timestamps for last updated times.
5. If no active flows exist, the CLI shall display a helpful message with example start command.

### Requirement 4: Abort Command
**Objective:** As a developer, I want to safely abort a flow and cleanup resources, so that I can cancel unwanted feature work cleanly.

#### Acceptance Criteria
1. When abort is invoked, the CLI shall render a confirmation prompt for the destructive action.
2. The CLI shall offer options to delete or keep the feature branch.
3. If a PR exists, the CLI shall close it using GitHub CLI via TypeScript child process.
4. The CLI shall remove the git worktree using TypeScript git operations.
5. The CLI shall optionally archive flow state by renaming flow-state.json.
6. The CLI shall report success/failure for each cleanup action taken.

### Requirement 5: Error Handling and Recovery
**Objective:** As a developer, I want the CLI to handle errors gracefully and provide recovery options, so that I can resolve issues without losing work.

#### Acceptance Criteria
1. If git operations fail, the CLI shall catch the error and render retry/skip/abort options.
2. If agent invocation fails, the CLI shall capture output and render retry/continue/abort options.
3. If network operations fail (including GitHub fetch), the CLI shall render retry/save-and-exit/abort options.
4. The CLI shall persist flow-state.json before any operation that might fail.
5. The CLI shall implement error boundaries in Ink components to prevent crash propagation.
6. The CLI shall display actionable error messages with suggested fixes.
