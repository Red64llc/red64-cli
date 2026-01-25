---
description: List all active Kiro flows
allowed-tools: Bash, Read, Glob
---

# Kiro Flow - List

<background_information>
- **Mission**: List all active feature flows with their current status
- **Alias for**: `/kiro-flow:status` without arguments
</background_information>

<instructions>
## Execution

This is equivalent to running `/kiro-flow:status` without a feature name.

1. **Find all worktrees**:
   ```bash
   git worktree list
   ```

2. **Filter to feature worktrees**:
   - Look for paths containing `worktrees/`
   - Extract feature names

3. **For each feature**:
   - Read `.kiro/specs/{feature}/flow-state.json`
   - Extract: phase, updated_at, tasks progress (if applicable)

4. **Display as table**:

```
Active Kiro Flows
═══════════════════════════════════════════════════════════════

Feature              Phase                    Branch                Updated
─────────────────────────────────────────────────────────────────────────────
user-auth            implementing (3/5)       feature/user-auth     2h ago
payment-flow         design approval          feature/payment-flow  1d ago
api-v2               PR #42 ready             feature/api-v2        30m ago

Total: 3 active flows
```

5. **If no flows found**:
```
No Active Flows
═══════════════════════════════════════

To start a new feature flow:
  bin/kiro-flow start <feature-name> "<description>"

Example:
  bin/kiro-flow start user-auth "Add OAuth2 authentication with GitHub"
```

</instructions>

## Output Columns

| Column | Source | Format |
|--------|--------|--------|
| Feature | flow-state.feature | as-is |
| Phase | Computed from phases | Human readable |
| Branch | flow-state.branch | as-is |
| Updated | flow-state.updated_at | Relative time |

## Phase Display

Map internal state to human-readable:
- `init not completed` → "initializing"
- `requirements not approved` → "requirements approval"
- `design not approved` → "design approval"
- `tasks not approved` → "tasks approval"
- `implementation in progress` → "implementing (X/Y)"
- `validation not completed` → "validating"
- `pr not created` → "creating PR"
- `pr not merged` → "PR #N ready"
- `phase = completed` → "completed"
