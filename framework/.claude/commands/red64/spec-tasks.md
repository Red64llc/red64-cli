---
description: Generate implementation tasks for a specification
allowed-tools: Read, Task
argument-hint: <feature-name> [-y] [--sequential]
---

# Implementation Tasks Generator

## Parse Arguments
- Feature name: `$1`
- Auto-approve flag: `$2` (optional, "-y")
- Sequential mode flag: `$3` (optional, "--sequential")

## Validate
Check that design has been completed:
- Verify `.red64/specs/$1/` exists
- Verify `.red64/specs/$1/design.md` exists
- Determine `sequential = ($3 == "--sequential")`

If validation fails, inform user to complete design phase first.

## Invoke Subagent

Delegate task generation to spec-tasks-agent:

Use the Task tool to invoke the Subagent with file path patterns:

```
Task(
  subagent_type="spec-tasks-agent",
  description="Generate implementation tasks",
  prompt="""
Feature: $1
Spec directory: .red64/specs/$1/
Auto-approve: {true if $2 == "-y", else false}
Sequential mode: {true if sequential else false}

File patterns to read:
- .red64/specs/$1/*.{json,md}
- .red64/steering/*.md
- .red64/settings/rules/tasks-generation.md
- .red64/settings/rules/tasks-parallel-analysis.md (include only when sequential mode is false)
- .red64/settings/templates/specs/tasks.md

Mode: {generate or merge based on tasks.md existence}
Instruction highlights:
- Map all requirements to tasks and list requirement IDs only (comma-separated) without extra narration
- Promote single actionable sub-tasks to major tasks and keep container summaries concise
- Apply `(P)` markers only when parallel criteria met (omit in sequential mode)
- Mark optional acceptance-criteria-focused test coverage subtasks with `- [ ]*` only when deferrable post-MVP
"""
)
```

## Display Result

Show Subagent summary to user, then provide next step guidance:

### Next Phase: Implementation

**Before Starting Implementation**:
- **IMPORTANT**: Clear conversation history and free up context before running `/red64:spec-impl`
- This applies when starting first task OR switching between tasks
- Fresh context ensures clean state and proper task focus

**If Tasks Approved**:
- Execute specific task: `/red64:spec-impl $1 1.1` (recommended: clear context between each task)
- Execute multiple tasks: `/red64:spec-impl $1 1.1,1.2` (use cautiously, clear context between tasks)
- Without arguments: `/red64:spec-impl $1` (executes all pending tasks - NOT recommended due to context bloat)

**If Modifications Needed**:
- Provide feedback and re-run `/red64:spec-tasks $1`
- Existing tasks used as reference (merge mode)

**Note**: The implementation phase will guide you through executing tasks with appropriate context and validation.
