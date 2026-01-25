---
description: Show status of Kiro flow(s)
allowed-tools: Bash, Read, Glob
argument-hint: [feature-name]
---

# Kiro Flow - Status

<background_information>
- **Mission**: Display status of active feature flows
- **Key Features**:
  - Single feature: detailed status with all phases
  - No argument: summary of all active flows
</background_information>

<instructions>
## Parse Arguments
- Feature name: `$1` (optional)

## Single Feature Status (if $1 provided)

1. **Check flow exists**:
   - Check `worktrees/$1` exists
   - Read `.kiro/specs/$1/flow-state.json`
   - If not found, report error

2. **Display detailed status**:

```
Feature: {feature}
═══════════════════════════════════════

Description: {description}
Branch: feature/{feature}
Worktree: worktrees/{feature}
Created: {created_at}
Last Updated: {updated_at}

Phases:
  {check_mark(init)} Initialize
  {check_mark(requirements)} Requirements {approval_status(requirements)}
  {check_mark(design)} Design {approval_status(design)}
  {check_mark(tasks)} Tasks {approval_status(tasks)}
  {check_mark(implementation)} Implementation {task_progress}
  {check_mark(validation)} Validation
  {check_mark(pr)} PR & Merge {pr_status}

{additional_details}
```

Where:
- `check_mark(phase)` = `[✓]` if completed, `[◐]` if in progress, `[ ]` if pending
- `approval_status(phase)` = `(approved)` if approved, `(pending approval)` if completed but not approved, empty otherwise
- `task_progress` = `({completed}/{total} tasks)` if in implementation phase
- `pr_status` = `(PR #{number})` if created, `(merged)` if merged

3. **Additional details for implementation phase**:
```
Implementation Progress:
  Completed: {list of completed task IDs}
  Remaining: {list of remaining task IDs}
  Commits: {number of implementation commits}
```

4. **Additional details for PR phase**:
```
Pull Request:
  URL: {pr_url}
  Status: {created/merged/closed}
```

## All Flows Status (if no argument)

1. **Find all active flows**:
   ```bash
   git worktree list | grep "worktrees/"
   ```

2. **For each worktree, read flow-state.json**

3. **Display summary table**:

```
Active Flows
═══════════════════════════════════════════════════════════════

Feature              Phase                    Last Updated
─────────────────────────────────────────────────────────────
user-auth            implementing (3/5)       2 hours ago
payment-flow         awaiting design approval 1 day ago
api-v2               PR ready to merge        30 minutes ago

Total: 3 active flows

Commands:
  kiro-flow status <feature>   View detailed status
  kiro-flow resume <feature>   Resume a paused flow
  kiro-flow abort <feature>    Abort a flow
```

4. **If no active flows**:
```
No Active Flows
═══════════════════════════════════════

Start a new flow:
  kiro-flow start <feature-name> "<description>"

Example:
  kiro-flow start user-auth "Add OAuth2 authentication with GitHub"
```

</instructions>

## Helper Functions

### Phase Status Text
| Phase State | Display Text |
|-------------|--------------|
| requirements completed, not approved | "awaiting requirements approval" |
| requirements approved | "requirements approved" |
| design completed, not approved | "awaiting design approval" |
| design approved | "design approved" |
| tasks completed, not approved | "awaiting tasks approval" |
| tasks approved | "tasks approved" |
| implementation in progress | "implementing (X/Y)" |
| implementation completed | "implementation complete" |
| validation completed | "validated" |
| pr created, not merged | "PR ready to merge" |
| pr merged | "completed" |

### Time Ago
Convert timestamp to relative time:
- < 1 hour: "X minutes ago"
- < 24 hours: "X hours ago"
- < 7 days: "X days ago"
- >= 7 days: "on {date}"
