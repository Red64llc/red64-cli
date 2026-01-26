# Research & Design Decisions: red64-flow-core

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `red64-flow-core`
- **Discovery Scope**: Extension (builds on existing red64-cli-scaffold)
- **Key Findings**:
  - Git worktree operations via Node.js child_process.spawn() are well-documented and reliable
  - GitHub CLI (gh) is the preferred approach for PR creation over direct API calls
  - State machine extension requires variant-aware transition logic for greenfield/brownfield modes

## Research Log

### Git Worktree Operations

- **Context**: Requirements 1.3, 1.4 specify creating isolated git worktrees for feature development
- **Sources Consulted**:
  - [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
  - [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- **Findings**:
  - `git worktree add -b <branch> <path> [<commit-ish>]` creates a new worktree with a new branch
  - `git worktree list --porcelain` provides machine-parseable output for checking existing worktrees
  - `git worktree remove <path>` requires `--force` for unclean worktrees
  - Node.js `spawn()` is preferred over `exec()` for streaming output and better error handling
- **Implications**:
  - Implement git operations as async functions using spawn with proper error handling
  - Use `--porcelain` format for parsing worktree list output
  - Handle cleanup gracefully with force option when needed

### GitHub CLI PR Creation

- **Context**: Requirement 6.3 specifies using GitHub CLI for PR creation
- **Sources Consulted**:
  - [gh pr create Manual](https://cli.github.com/manual/gh_pr_create)
  - [GitHub CLI Overview](https://cli.github.com/manual/gh_pr)
- **Findings**:
  - `gh pr create --title <title> --body <body> --base <branch>` creates a PR
  - `--body-file <file>` can read body from file (useful for spec artifacts)
  - Exit code 0 indicates success; non-zero indicates error
  - PR URL is written to stdout on success
- **Implications**:
  - Use spawn to invoke `gh pr create` with structured arguments
  - Generate PR body by reading and formatting spec artifacts
  - Parse stdout for PR URL to display to user

### State Machine Extension for Workflow Modes

- **Context**: Requirements 2.5, 4.1-4.5 require greenfield/brownfield workflow variants
- **Sources Consulted**:
  - Existing FlowStateMachine.ts implementation in scaffold
  - State machine design patterns
- **Findings**:
  - Current scaffold uses discriminated unions for FlowPhase and FlowEvent
  - Brownfield requires additional phases: gap-analysis, gap-review, design-validation, design-validation-review
  - Phase sequence can be encoded as ordered arrays per workflow mode
  - Transition function can use mode metadata to determine valid next phases
- **Implications**:
  - Extend FlowPhase union with brownfield-specific phases
  - Add workflow mode to FlowState metadata
  - Create phase sequence constants for each mode
  - Transition function checks mode when determining valid transitions

### Task Parsing from tasks.md

- **Context**: Requirement 5.1 requires parsing tasks.md to extract task list
- **Sources Consulted**:
  - Kiro tasks.md format from existing specs
  - Markdown parsing approaches
- **Findings**:
  - Tasks are formatted as markdown with headings and checkboxes
  - Task format: `## Task N: Title` followed by description
  - Completion status can be tracked with `- [x]` or `- [ ]` checkboxes
  - Simple regex parsing is sufficient; no heavy markdown library needed
- **Implications**:
  - Implement lightweight task parser using regex
  - Extract task ID, title, and completion status
  - Track current task index in FlowPhase

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Extend existing state machine | Add brownfield phases to existing FlowPhase union | Maintains consistency, single transition function | Growing phase count may become unwieldy | Selected - aligns with scaffold foundation |
| Separate state machines per mode | Distinct machines for greenfield/brownfield | Cleaner separation of concerns | Code duplication, harder to share common phases | Rejected - over-engineering for two modes |
| Hierarchical state machine | Nested states for approval and validation | Better modeling of sub-states | More complex implementation | Considered for future if complexity grows |

## Design Decisions

### Decision: Git Operations via spawn()

- **Context**: Requirements 1.3, 1.4, 5.3, 6.1, 6.6 require git operations for worktree, commit, push, merge
- **Alternatives Considered**:
  1. Use simple-git npm package - wrapper library for git
  2. Use isomorphic-git - pure JS git implementation
  3. Direct spawn() with git CLI
- **Selected Approach**: Direct spawn() with git CLI
- **Rationale**:
  - No additional dependencies beyond Node.js core
  - Full git feature support (worktrees, squash merge)
  - Consistent with AgentInvoker pattern already established
  - Better error messages from git CLI directly
- **Trade-offs**:
  - Requires git to be installed on system (reasonable for CLI tool)
  - Must parse CLI output for results
- **Follow-up**: Ensure proper error handling for git not found scenario

### Decision: GitHub CLI for PR Creation

- **Context**: Requirement 6.3 specifies PR creation
- **Alternatives Considered**:
  1. GitHub REST API via @octokit/rest
  2. GitHub GraphQL API
  3. GitHub CLI (gh)
- **Selected Approach**: GitHub CLI (gh) via spawn()
- **Rationale**:
  - Handles authentication automatically (gh auth)
  - Simpler than managing API tokens
  - Consistent with git operations pattern
  - Better UX for developers who already use gh
- **Trade-offs**:
  - Requires gh to be installed
  - Less programmatic control than direct API
- **Follow-up**: Add pre-flight check for gh availability

### Decision: Checkpoint Every 3 Tasks

- **Context**: Requirement 5.5 specifies checkpoint interval during implementation
- **Alternatives Considered**:
  1. Checkpoint after every task
  2. Checkpoint every N tasks (configurable)
  3. Time-based checkpoints
- **Selected Approach**: Checkpoint every 3 tasks with user prompt
- **Rationale**:
  - Balances autonomy with user control
  - Prevents runaway implementation
  - Allows course correction mid-implementation
- **Trade-offs**:
  - Fixed interval may not suit all projects
  - Could add --checkpoint-interval flag later
- **Follow-up**: Make interval configurable via CLI flag in future

### Decision: Worktree Path Convention

- **Context**: Requirement 1.4 specifies worktree location
- **Alternatives Considered**:
  1. `worktrees/<feature>/` - parallel to main repo
  2. `.worktrees/<feature>/` - hidden in repo root
  3. `../<repo>-<feature>/` - sibling directory
- **Selected Approach**: `worktrees/<feature>/` relative to repo root
- **Rationale**:
  - Visible but organized
  - Easy to find and navigate
  - Consistent path pattern
  - .gitignore can exclude worktrees/ directory
- **Trade-offs**:
  - Takes space in project directory
  - Must be added to .gitignore
- **Follow-up**: Ensure .gitignore is updated during init

## Risks & Mitigations

- **Risk 1**: Git or gh CLI not installed - Mitigation: Pre-flight checks with clear error messages and installation instructions
- **Risk 2**: State file corruption during concurrent operations - Mitigation: Atomic writes already implemented in StateStore; add advisory locking if needed
- **Risk 3**: Task parsing fails on non-standard tasks.md format - Mitigation: Validate task format during parsing; provide clear error with expected format
- **Risk 4**: Long-running implementation phases - Mitigation: Checkpoint prompts every 3 tasks; pause state persistence; resume capability

## References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) - Official git worktree reference
- [Node.js Child Process](https://nodejs.org/api/child_process.html) - spawn() and child process management
- [gh pr create Manual](https://cli.github.com/manual/gh_pr_create) - GitHub CLI PR creation
- [Ink Framework Steering](/.kiro/steering/ink.md) - Component patterns for terminal UI
- [red64-cli-scaffold Design](/.kiro/specs/red64-cli-scaffold/design.md) - Foundation architecture
