---
description: Resume a paused or interrupted Kiro flow
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Skill, AskUserQuestion
argument-hint: <feature-name>
---

# Kiro Flow - Resume

<background_information>
- **Mission**: Resume a paused or interrupted feature development flow
- **Key Features**:
  - Reads state from flow-state.json
  - Handles uncommitted changes
  - Continues from the exact point where flow stopped
- **Success Criteria**:
  - Flow continues from correct checkpoint
  - No work is lost or duplicated
</background_information>

<instructions>
## Parse Arguments
- Feature name: `$1` (required)

## Validation

1. **Check worktree exists**:
   ```bash
   git worktree list | grep -q "worktrees/$1"
   ```
   - If not found, report error: "No worktree found for '$1'. Use 'kiro-flow list' to see active flows."

2. **Check flow-state.json exists**:
   - Read `.kiro/specs/$1/flow-state.json`
   - If not found, report error: "No flow state found for '$1'."

3. **Read current state**:
   - Parse flow-state.json
   - Determine current phase and completion status

## Handle Uncommitted Changes

Change to worktree directory: `worktrees/$1`

Check for uncommitted changes:
```bash
git status --porcelain
```

If changes exist:
- Display: "Uncommitted changes found:"
- Show git diff summary
- Ask user with AskUserQuestion:
  - "How to handle uncommitted changes?"
  - Options:
    - "Commit changes" - Commit with appropriate message
    - "Discard changes" - `git checkout -- .`
    - "Abort resume" - Exit without changes

## Determine Resume Point

Read the `mode` from flow-state.json to determine if this is greenfield or brownfield.

Based on flow-state.json, determine the next action:

### Common States (Both Modes)

| Current State | Resume Action |
|---------------|---------------|
| `phases.init.completed = false` | Start from Phase 2 (Initialize Flow State) |
| `phases.requirements.completed = false` | Run requirements generation |
| `phases.requirements.approved = false` | Go to requirements approval gate |

### Brownfield-Only States (if `mode = "brownfield"`)

| Current State | Resume Action |
|---------------|---------------|
| `phases.gap_analysis.completed = false` | Run gap analysis (`/kiro:validate-gap`) |
| `phases.gap_analysis.reviewed = false` | Go to gap analysis review gate |

### Common States (continued)

| Current State | Resume Action |
|---------------|---------------|
| `phases.design.completed = false` | Run design generation |
| `phases.design.approved = false` | Go to design approval gate |

### Brownfield-Only States (if `mode = "brownfield"`)

| Current State | Resume Action |
|---------------|---------------|
| `phases.design_validation.completed = false` | Run design validation (`/kiro:validate-design`) |
| `phases.design_validation.reviewed = false` | Go to design validation review gate |

### Common States (continued)

| Current State | Resume Action |
|---------------|---------------|
| `phases.tasks.completed = false` | Run tasks generation |
| `phases.tasks.approved = false` | Go to tasks approval gate |
| `phases.implementation.tasks_remaining.length > 0` | Continue implementation from next task |
| `phases.implementation.completed = false` | Mark implementation complete |
| `phases.validation.completed = false` | Run validation |
| `phases.pr.created = false` | Create PR |
| `phases.pr.merged = false` | Go to merge gate |
| `phase = "completed"` | Report: "Flow already completed" |

## Resume Execution

Display: "Resuming '$1' at phase: {determined phase}"

Execute the appropriate phase from `/kiro-flow:start`:

### If resuming requirements approval:
- Read `.kiro/specs/$1/requirements.md`
- Present summary
- Ask for approval

### If resuming gap analysis (brownfield only):
- Run `/kiro:validate-gap $1`
- Commit results
- Present gap analysis summary
- Ask for review/continue

### If resuming gap analysis review (brownfield only):
- Read gap analysis output
- Present findings summary
- Ask user to continue to design or revise requirements

### If resuming design approval:
- Read `.kiro/specs/$1/design.md`
- Present summary
- Ask for approval

### If resuming design validation (brownfield only):
- Run `/kiro:validate-design $1`
- Commit results
- Present design validation summary
- Ask for review/continue

### If resuming design validation review (brownfield only):
- Read design validation output
- Present findings summary
- Ask user to continue to tasks or revise design

### If resuming tasks approval:
- Read `.kiro/specs/$1/tasks.md`
- Present summary
- Ask for approval

### If resuming implementation:
- Read tasks_completed and tasks_remaining from flow-state
- Display: "Completed: {tasks_completed}"
- Display: "Remaining: {tasks_remaining}"
- Continue with first task in tasks_remaining

### If resuming validation:
- Run `/kiro:validate-impl $1`

### If resuming PR creation:
- Push branch and create PR

### If resuming merge:
- Display PR URL from flow-state
- Ask for merge approval

## State Updates

After each step:
- Update flow-state.json with new status
- Commit state changes if significant

</instructions>

## Output Format

For **greenfield** mode:
```
Resuming Flow: {feature}
Mode: Greenfield
═══════════════════════════════════════

Current State:
  Phase: {phase}
  Last Updated: {updated_at}

Progress:
  [✓] Initialize
  [✓] Requirements (approved)
  [✓] Design (approved)
  [ ] Tasks
  [ ] Implementation
  [ ] Validation
  [ ] PR & Merge

Resuming from: {phase name}...
```

For **brownfield** mode:
```
Resuming Flow: {feature}
Mode: Brownfield
═══════════════════════════════════════

Current State:
  Phase: {phase}
  Last Updated: {updated_at}

Progress:
  [✓] Initialize
  [✓] Requirements (approved)
  [✓] Gap Analysis (reviewed)
  [✓] Design (approved)
  [ ] Design Validation
  [ ] Tasks
  [ ] Implementation
  [ ] Validation
  [ ] PR & Merge

Resuming from: {phase name}...
```

Then continue with normal flow output.
