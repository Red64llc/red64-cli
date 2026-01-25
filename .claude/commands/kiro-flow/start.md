---
description: Start a new feature development flow with git worktree isolation
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Skill, AskUserQuestion
argument-hint: <feature-name> "<description>" [--mode=greenfield|brownfield]
---

# Kiro Flow - Start New Feature

<background_information>
- **Mission**: Orchestrate complete spec-driven development flow with git integration
- **Key Features**:
  - Git worktree isolation for each feature
  - Granular commits at each phase
  - HITL approval gates for requirements, design, tasks
  - Two workflow modes:
    - **Greenfield**: init → requirements → design → tasks → impl → validation → PR
    - **Brownfield**: init → requirements → GAP ANALYSIS → design → DESIGN VALIDATION → tasks → impl → validation → PR
- **Success Criteria**:
  - Feature developed in isolated worktree
  - Each phase committed separately
  - User approves at each gate
  - PR created and ready for merge
</background_information>

<instructions>
## Parse Arguments
- Feature name: `$1` (required) - must be lowercase, kebab-case
- Description: `$2` (required) - quoted string describing the feature
- Mode: `$3` (optional) - `--mode=greenfield` (default) or `--mode=brownfield`

Extract mode from third argument:
```
MODE=${3:-"--mode=greenfield"}
MODE=${MODE#--mode=}  # Strip prefix to get just "greenfield" or "brownfield"
```

## Pre-flight Checks

1. **Validate feature name**:
   - Must be lowercase
   - Must start with a letter
   - Only letters, numbers, hyphens allowed
   - If invalid, report error and exit

2. **Check for existing worktree**:
   ```bash
   git worktree list | grep -q "worktrees/$1" && echo "exists"
   ```
   - If exists, ask user: continue with existing or abort?

3. **Check git status**:
   ```bash
   git status --porcelain
   ```
   - If uncommitted changes in main repo, warn user

4. **Get default branch**:
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"
   ```

## Phase 1: Initialize Worktree

```bash
# Ensure we're up to date
git fetch origin
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
git checkout $DEFAULT_BRANCH
git pull origin $DEFAULT_BRANCH

# Create worktree
mkdir -p worktrees
git worktree add worktrees/$1 -b feature/$1
```

Change working context to: `worktrees/$1`

## Phase 2: Initialize Flow State

Create `.kiro/specs/$1/flow-state.json`:

For **greenfield** mode:
```json
{
  "feature": "$1",
  "description": "$2",
  "mode": "greenfield",
  "branch": "feature/$1",
  "worktree": "worktrees/$1",
  "phase": "initialized",
  "phases": {
    "init": { "completed": false },
    "requirements": { "completed": false, "approved": false },
    "design": { "completed": false, "approved": false },
    "tasks": { "completed": false, "approved": false },
    "implementation": { "completed": false, "tasks_completed": [], "tasks_remaining": [] },
    "validation": { "completed": false },
    "pr": { "created": false, "merged": false }
  },
  "created_at": "{{TIMESTAMP}}",
  "updated_at": "{{TIMESTAMP}}"
}
```

For **brownfield** mode:
```json
{
  "feature": "$1",
  "description": "$2",
  "mode": "brownfield",
  "branch": "feature/$1",
  "worktree": "worktrees/$1",
  "phase": "initialized",
  "phases": {
    "init": { "completed": false },
    "requirements": { "completed": false, "approved": false },
    "gap_analysis": { "completed": false, "reviewed": false },
    "design": { "completed": false, "approved": false },
    "design_validation": { "completed": false, "reviewed": false },
    "tasks": { "completed": false, "approved": false },
    "implementation": { "completed": false, "tasks_completed": [], "tasks_remaining": [] },
    "validation": { "completed": false },
    "pr": { "created": false, "merged": false }
  },
  "created_at": "{{TIMESTAMP}}",
  "updated_at": "{{TIMESTAMP}}"
}
```

Commit:
```bash
git add .kiro/specs/$1/flow-state.json
git commit -m "chore($1): initialize worktree and flow state"
```

Update flow-state: `phases.init.completed = true`

## Phase 3: Spec Initialization

Run `/kiro:spec-init "$2"` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): initialize specification"
```

## Phase 4: Requirements Generation

Run `/kiro:spec-requirements $1` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): generate EARS requirements"
```

Update flow-state: `phases.requirements.completed = true`

**[HITL Gate]** Present requirements summary:
- Read `.kiro/specs/$1/requirements.md`
- Display first 10-15 requirements as bullet points
- Show total count

Ask user with AskUserQuestion:
- Question: "Review the requirements above. Do you approve them to proceed to design?"
- Options:
  - "Approve requirements" - Continue to design
  - "Request changes" - Specify changes, regenerate
  - "Abort flow" - Stop and cleanup

If approved:
```bash
git commit --allow-empty -m "spec($1): requirements approved"
```
Update flow-state: `phases.requirements.approved = true`

## Phase 4.5: Gap Analysis (Brownfield Only)

**Skip this phase if mode is "greenfield"**

If mode is "brownfield":

Run `/kiro:validate-gap $1` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): gap analysis complete"
```

Update flow-state: `phases.gap_analysis.completed = true`

**[HITL Gate]** Present gap analysis summary:
- Read gap analysis output from the validation
- Display key findings:
  - Existing code that can be reused
  - Code that needs modification
  - New code to be written
  - Potential conflicts or integration points

Ask user with AskUserQuestion:
- Question: "Review the gap analysis above. This shows how the new feature will integrate with existing code. Continue to design?"
- Options:
  - "Continue to design" - Proceed with gap analysis insights
  - "Revise requirements" - Go back and update requirements
  - "Abort flow" - Stop and cleanup

If continue:
```bash
git commit --allow-empty -m "spec($1): gap analysis reviewed"
```
Update flow-state: `phases.gap_analysis.reviewed = true`

## Phase 5: Design Generation

Run `/kiro:spec-design $1` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): generate technical design"
```

Update flow-state: `phases.design.completed = true`

**[HITL Gate]** Present design summary:
- Read `.kiro/specs/$1/design.md`
- Display architecture overview section
- List key components

Ask user for approval (same pattern as requirements).

If approved:
```bash
git commit --allow-empty -m "spec($1): design approved"
```
Update flow-state: `phases.design.approved = true`

## Phase 5.5: Design Validation (Brownfield Only)

**Skip this phase if mode is "greenfield"**

If mode is "brownfield":

Run `/kiro:validate-design $1` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): design validation complete"
```

Update flow-state: `phases.design_validation.completed = true`

**[HITL Gate]** Present design validation summary:
- Read design validation output
- Display key findings:
  - Architectural alignment with existing system
  - Integration point compatibility
  - Potential breaking changes
  - Recommendations for safer integration

Ask user with AskUserQuestion:
- Question: "Review the design validation above. This confirms the design works with your existing codebase. Continue to task planning?"
- Options:
  - "Continue to tasks" - Proceed to task breakdown
  - "Revise design" - Go back and update design
  - "Abort flow" - Stop and cleanup

If continue:
```bash
git commit --allow-empty -m "spec($1): design validation reviewed"
```
Update flow-state: `phases.design_validation.reviewed = true`

## Phase 6: Tasks Generation

Run `/kiro:spec-tasks $1` and wait for completion.

Commit:
```bash
git add .kiro/specs/$1/
git commit -m "spec($1): generate implementation tasks"
```

Update flow-state: `phases.tasks.completed = true`

**[HITL Gate]** Present tasks summary:
- Read `.kiro/specs/$1/tasks.md`
- Display major tasks (numbered 1, 2, 3...)
- Show total count and estimated effort

Ask user for approval (same pattern as requirements).

If approved:
- Parse tasks.md to extract task IDs
- Update flow-state: `phases.tasks.approved = true`, `phases.implementation.tasks_remaining = [task IDs]`
```bash
git commit --allow-empty -m "spec($1): tasks approved"
```

## Phase 7: Implementation

For each major task in tasks_remaining:

1. Display: "Starting task {N}: {title}"

2. Run `/kiro:spec-impl $1 {task-id}`

3. Commit:
   ```bash
   git add -A
   git commit -m "feat($1): implement task {N} - {brief summary}"
   ```

4. Update flow-state:
   - Move task from tasks_remaining to tasks_completed
   - Record commit SHA

5. **[Checkpoint]** Every 3 tasks, ask user:
   - "Continue to next task?"
   - Options: Continue / Pause (save state) / Abort

After all tasks:
```bash
git commit --allow-empty -m "feat($1): complete implementation"
```
Update flow-state: `phases.implementation.completed = true`

## Phase 8: Validation

Run `/kiro:validate-impl $1` and wait for completion.

If issues found:
- Display issues
- Ask user: "Fix automatically?" / "Fix manually?" / "Skip validation"
- If fix automatically, fix and commit:
  ```bash
  git add -A
  git commit -m "fix($1): address validation findings"
  ```
- Re-run validation until passes

Update flow-state: `phases.validation.completed = true`

## Phase 9: Create Pull Request

```bash
git push -u origin feature/$1
```

Generate PR body from spec artifacts:
- Read requirements.md → Extract top 5 acceptance criteria
- Read design.md → Extract architecture summary
- Read tasks.md → List completed tasks

Create PR:
```bash
gh pr create \
  --title "feat($1): {short description from spec}" \
  --body "{generated body with template below}" \
  --base $DEFAULT_BRANCH
```

PR body template:
```markdown
## Summary
{bullet points from requirements}

## Technical Approach
{architecture overview from design}

## Changes
{completed tasks list}

## Spec Artifacts
- [Requirements](.kiro/specs/$1/requirements.md)
- [Design](.kiro/specs/$1/design.md)
- [Tasks](.kiro/specs/$1/tasks.md)

---
*Generated by Kiro Flow Orchestrator*
```

Update flow-state: `phases.pr.created = true`, `phases.pr.url = {PR URL}`

Display PR URL to user.

## Phase 10: Merge

**[HITL Gate]** Ask user:
- "PR created. Ready to merge?"
- Options:
  - "Merge now (squash)" - Merge and cleanup
  - "Wait for review" - Exit, merge manually later
  - "Abort" - Close PR

If "Merge now":
```bash
gh pr merge feature/$1 --squash --delete-branch
cd {project-root}
git worktree remove worktrees/$1
```

Update flow-state: `phases.pr.merged = true`, `phase = "completed"`

Display success message with merge commit.

</instructions>

## Error Recovery

- **Git errors**: Display error, offer retry/skip/abort
- **Skill errors**: Display output, offer retry/continue-anyway/abort
- **Network errors**: Display error, offer retry/save-and-exit/abort
- **Always**: Update flow-state.json so resume works

## Output Format

After each phase, display:
- Phase name completed
- Commit SHA
- Next phase or action

Final output:
- Summary of all phases completed
- Total commits created
- PR URL (if created)
- Instructions for any remaining steps
