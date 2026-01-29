---
description: Execute spec tasks using TDD methodology
allowed-tools: Read, Task
argument-hint: <feature-name> [task-numbers]
---

# Implementation Task Executor

## Parse Arguments
- Feature name: `$1`
- Task numbers: `$2` (optional)
  - Format: "1.1" (single task) or "1,2,3" (multiple tasks)
  - If not provided: Execute all pending tasks

## Validate
Check that tasks have been generated:
- Verify `.red64/specs/$1/` exists
- Verify `.red64/specs/$1/tasks.md` exists

If validation fails, inform user to complete tasks generation first.

## Task Selection Logic

**Parse task numbers from `$2`** (perform this in Slash Command before invoking Subagent):
- If `$2` provided: Parse task numbers (e.g., "1.1", "1,2,3")
- Otherwise: Read `.red64/specs/$1/tasks.md` and find all unchecked tasks (`- [ ]`)

## Detect UI-Related Tasks

Before invoking the subagent, analyze the tasks to determine if they involve UI work:

**UI Detection Keywords** (in task description or design.md):
- Component, page, layout, view, screen
- Style, CSS, Tailwind, styled-components
- Button, form, input, modal, dialog
- Visual, UI, UX, design, mockup
- Frontend, client-side, browser

If UI-related keywords detected, set `UI Mode: enabled` in the prompt.

## Invoke Subagent

Delegate TDD implementation to spec-tdd-impl-agent:

Use the Task tool to invoke the Subagent with file path patterns:

```
Task(
  subagent_type="spec-tdd-impl-agent",
  description="Execute TDD implementation",
  prompt="""
Feature: $1
Spec directory: .red64/specs/$1/
Target tasks: {parsed task numbers or "all pending"}

File patterns to read:
- .red64/specs/$1/*.{json,md}
- .red64/steering/*.md

TDD Mode: strict (test-first)
UI Mode: {enabled if UI-related, disabled otherwise}

## Feedback Requirements
After EVERY implementation change:
1. Run project tests: Use command from .red64/steering/feedback.md
2. Fix any test failures before proceeding
3. If UI Mode enabled: Use agent-browser for visual verification
   - Start dev server if not running
   - Capture screenshots of implemented UI
   - Compare against design specifications
   - Fix visual discrepancies before marking complete
"""
)
```

## Display Result

Show Subagent summary to user, then provide next step guidance:

### Task Execution

**Execute specific task(s)**:
- `/red64:spec-impl $1 1.1` - Single task
- `/red64:spec-impl $1 1,2,3` - Multiple tasks

**Execute all pending**:
- `/red64:spec-impl $1` - All unchecked tasks

**Before Starting Implementation**:
- **IMPORTANT**: Clear conversation history and free up context before running `/red64:spec-impl`
- This applies when starting first task OR switching between tasks
- Fresh context ensures clean state and proper task focus
