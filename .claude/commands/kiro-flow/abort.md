---
description: Abort a Kiro flow and cleanup resources
allowed-tools: Bash, Read, Write, AskUserQuestion
argument-hint: <feature-name>
---

# Kiro Flow - Abort

<background_information>
- **Mission**: Safely abort a feature flow and cleanup all resources
- **Key Features**:
  - Confirms before destructive action
  - Offers to keep or delete branch
  - Closes PR if exists
  - Removes worktree
  - Archives flow state (optional)
</background_information>

<instructions>
## Parse Arguments
- Feature name: `$1` (required)

## Validation

1. **Check flow exists**:
   - Check if `worktrees/$1` exists OR `.kiro/specs/$1/flow-state.json` exists
   - If neither found, report error: "No flow found for '$1'"

2. **Read current state** (if exists):
   - Parse flow-state.json
   - Check if PR was created

## Confirmation

**[HITL Gate]** Ask user with AskUserQuestion:
- Question: "Abort flow '$1'? This will remove the worktree. What should happen to the branch?"
- Options:
  - "Abort and delete branch" - Full cleanup including branch
  - "Abort but keep branch" - Remove worktree, keep branch for manual work
  - "Cancel" - Don't abort

If "Cancel", exit with message: "Abort cancelled."

## Cleanup Steps

### Step 1: Close PR (if exists)

If `phases.pr.created = true` and `phases.pr.merged = false`:
```bash
gh pr close feature/$1 --comment "Aborted via kiro-flow"
```

### Step 2: Remove Worktree

```bash
# Force remove in case of uncommitted changes
git worktree remove worktrees/$1 --force
```

If worktree removal fails:
```bash
# Manual cleanup if git worktree fails
rm -rf worktrees/$1
git worktree prune
```

### Step 3: Delete Branch (if requested)

If user selected "Abort and delete branch":

```bash
# Delete local branch
git branch -D feature/$1

# Delete remote branch (if pushed)
git push origin --delete feature/$1 2>/dev/null || true
```

### Step 4: Archive Flow State (optional)

Move flow-state.json to archived location:
```bash
mv .kiro/specs/$1/flow-state.json .kiro/specs/$1/flow-state.aborted.json
```

Or optionally ask user:
- "Archive the spec artifacts or delete them?"
- Options:
  - "Archive" - Keep in .kiro/specs/$1/ with .aborted suffix
  - "Delete" - Remove entire .kiro/specs/$1/ directory

## Output

```
Flow Aborted: {feature}
═══════════════════════════════════════

Actions taken:
  {✓/✗} Closed PR #{number}
  {✓/✗} Removed worktree
  {✓/✗} Deleted local branch
  {✓/✗} Deleted remote branch
  {✓/✗} Archived flow state

The flow has been aborted. Spec artifacts are {preserved/deleted} at:
  .kiro/specs/$1/
```

## Error Handling

- **Worktree removal fails**: Try force removal, then manual rm + prune
- **Branch deletion fails**: May already be deleted or never pushed - continue
- **PR close fails**: May already be closed or merged - continue
- **Always report what succeeded and what failed**

</instructions>

## Safety Notes

- Never delete main/master branch
- Always confirm before destructive actions
- Preserve spec artifacts by default (user can manually delete)
- Log all actions for debugging
