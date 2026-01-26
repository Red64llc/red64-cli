# Implementation Plan

## Task 1. Core Services Layer

- [ ] 1.1 (P) Implement git status checking service
  - Create service to execute git status command and parse porcelain output
  - Detect staged, unstaged, and untracked file counts
  - Return boolean indicator for any uncommitted changes
  - Handle worktree context and non-git directory errors
  - _Requirements: 1.3, 5.1_

- [ ] 1.2 (P) Implement PR status fetching service
  - Create service to query PR information via GitHub CLI
  - Parse PR JSON response for state, mergeability, review decision, and checks status
  - Implement PR close functionality for abort flows
  - Handle unauthenticated and network error states gracefully
  - _Requirements: 2.4, 4.3_

- [ ] 1.3 (P) Implement branch management service
  - Create service for local branch deletion with optional force flag
  - Implement remote branch deletion via git push
  - Add branch existence check
  - Enforce protection against deleting main/master/develop branches
  - _Requirements: 4.2_

- [ ] 1.4 Extend state store with archive capability
  - Add archive method to rename state file for historical preservation
  - Ensure atomic operation to prevent data loss
  - Depends on existing StateStore interface from flow-core
  - _Requirements: 4.5_

## Task 2. Shared UI Components

- [ ] 2.1 (P) Create phase progress visualization component
  - Render phase list with visual status indicators
  - Show green checkmark for completed phases
  - Show yellow spinner for current in-progress phase
  - Show dim empty circle for pending phases
  - Support both greenfield and brownfield workflow modes
  - _Requirements: 1.4, 2.1, 2.2_

- [ ] 2.2 (P) Create flow listing table component
  - Render multi-column table with feature, phase, branch, and updated time
  - Implement fixed-width columns with truncation for long values
  - Sort flows by most recently updated first
  - Apply proper box styling for terminal table appearance
  - _Requirements: 3.3, 3.4_

- [ ] 2.3 (P) Create error display component
  - Render error messages with red color styling
  - Display actionable suggestions with yellow highlighting
  - Include relevant context like file paths or commands
  - Keep messages concise and user-friendly
  - _Requirements: 5.6_

- [ ] 2.4 Create error recovery prompt component
  - Present recovery options via selection menu
  - Support git errors with retry/skip/abort choices
  - Support agent errors with retry/continue/abort choices
  - Support network errors with retry/save-and-exit/abort choices
  - Return selected recovery option to parent component
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 2.5 Create error boundary wrapper component
  - Implement React error boundary pattern for Ink components
  - Capture unhandled errors and prevent crash propagation
  - Display error message with stack trace in debug mode
  - Provide exit prompt for graceful termination
  - _Requirements: 5.5_

## Task 3. Resume Screen Implementation

- [ ] 3.1 Implement flow state loading and validation for resume
  - Load persisted flow state from storage by feature name
  - Compute resume point from persisted phase data
  - Display helpful error when no flow exists for the feature
  - Show loading indicator during state retrieval
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 3.2 Implement uncommitted changes detection and prompting
  - Check worktree for uncommitted changes before resuming
  - Display prompt with commit, discard, or abort options
  - Execute git commit with WIP message on commit selection
  - Execute git checkout to discard on discard selection
  - Return to main flow on abort selection
  - _Requirements: 1.3_

- [ ] 3.3 Implement resume flow execution
  - Display completed phases with checkmarks before resuming
  - Re-enter state machine at the persisted phase
  - Persist state before state machine operations
  - Transition to appropriate phase screen upon resume
  - _Requirements: 1.4, 1.5, 5.4_

## Task 4. Status Screen Implementation

- [ ] 4.1 Implement flow status display
  - Load flow state for specified feature
  - Display phase progress using visualization component
  - Show relative timestamps using human-readable format
  - Display helpful error when no flow exists
  - _Requirements: 2.1, 2.2, 2.3, 2.6_

- [ ] 4.2 Implement PR and task status display
  - Fetch PR status when flow has associated PR
  - Display PR number, state, and merge status
  - Show completed and remaining task counts for implementation phase
  - Handle missing or inaccessible PR information gracefully
  - _Requirements: 2.4, 2.5_

## Task 5. List Screen Implementation

- [ ] 5. Implement active flows listing
  - Scan worktrees directory for all active flows
  - Load flow state for each discovered flow
  - Render summary table with all flows
  - Display relative timestamps for last updated
  - Show helpful message with example command when no flows exist
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

## Task 6. Abort Screen Implementation

- [ ] 6.1 Implement abort confirmation flow
  - Load flow state for specified feature
  - Display confirmation prompt for destructive action
  - Present branch deletion options via selection menu
  - Display helpful error when no flow exists
  - _Requirements: 4.1, 4.2_

- [ ] 6.2 Implement resource cleanup operations
  - Close associated PR via GitHub CLI if exists
  - Remove git worktree using worktree service
  - Delete or keep feature branch based on user selection
  - Archive or delete flow state based on configuration
  - _Requirements: 4.3, 4.4, 4.5_

- [ ] 6.3 Implement cleanup result reporting
  - Track success or failure for each cleanup action
  - Display checkmarks for successful operations
  - Display error indicators with messages for failed operations
  - Show summary of all cleanup actions taken
  - _Requirements: 4.6_

## Task 7. Error Handling Integration

- [ ] 7.1 Implement pre-operation state persistence
  - Save flow state before git operations that might fail
  - Save flow state before agent invocations
  - Save flow state before network operations
  - Ensure state is recoverable after unexpected termination
  - _Requirements: 5.4_

- [ ] 7.2 Integrate error recovery across screens
  - Wrap git operations with error catching and recovery prompt
  - Wrap agent invocations with error catching and retry logic
  - Wrap network operations with error catching and save-and-exit option
  - Connect error boundary at screen boundaries
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

## Task 8. Integration and Testing

- [ ] 8.1 Wire management screens to command router
  - Register resume screen with command routing
  - Register status screen with command routing
  - Register list screen with command routing
  - Register abort screen with command routing
  - Verify screen props interface compatibility
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [ ] 8.2 Implement service integration tests
  - Test git status checker with various worktree states
  - Test PR status fetcher with mocked GitHub CLI responses
  - Test branch service with mock git operations
  - Test state store archive functionality
  - _Requirements: 1.3, 2.4, 4.2, 4.3, 4.5_

- [ ] 8.3 Implement screen integration tests
  - Test resume screen flow from load through resume
  - Test status screen with various flow states and PR info
  - Test list screen with empty and populated flow lists
  - Test abort screen confirmation and cleanup sequence
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ]* 8.4 Implement UI component snapshot tests
  - Test phase progress view rendering across states
  - Test flow table rendering with various data
  - Test error display component formatting
  - Test error recovery prompt option rendering
  - Test error boundary error capture and display
  - _Requirements: 1.4, 2.1, 2.2, 3.3, 5.1, 5.2, 5.3, 5.5, 5.6_
