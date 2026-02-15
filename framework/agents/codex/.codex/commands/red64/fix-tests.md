---
description: Fix failing regression tests automatically
allowed-tools: Read, Bash, Task
argument-hint: [test-output]
---

# Fix Failing Tests

## Parse Arguments
- Test output: `$1` (optional - raw test failure output)

## Gather Test Failure Information

**If test output not provided**, run tests to capture failures:

1. Read `.red64/steering/feedback.md` to get the test command
2. If feedback.md doesn't exist, detect test command from project:
   - Check `package.json` for `scripts.test`
   - Check for `pytest.ini`, `pyproject.toml` (Python)
   - Check for `Rakefile` (Ruby)
3. Run the test command and capture output:
   ```bash
   {test_command} 2>&1
   ```

**If test output provided** (`$1` is not empty):
- Use the provided test output directly

## Analyze Failure Scope

Parse the test output to determine:
- Number of failing tests
- Test files affected
- Error types (assertion, runtime, type, etc.)

If all tests pass, report "All tests passing" and exit.

## Invoke Subagent

Delegate test fixing to fix-tests-agent:

Use the Task tool to invoke the Subagent:

```
Task(
  subagent_type="fix-tests-agent",
  description="Fix failing tests",
  prompt="""
Working directory: {current working directory}

Test output showing failures:
```
{test_output}
```

File patterns to read:
- .red64/steering/*.md (if exists)
- Test files mentioned in failures
- Source files from stack traces

Fix all failing tests and verify the test suite passes.
"""
)
```

## Display Result

Show Subagent summary to user, then provide next step guidance:

### If All Tests Fixed
- ✅ All tests now passing
- Continue with implementation or commit changes

### If Some Tests Still Failing
- ⚠️ Some tests could not be fixed automatically
- Review the reported issues
- Manual intervention may be required

### Usage

**Auto-detect and fix**:
- `/red64:fix-tests` - Run tests, detect failures, and fix them

**Provide test output**:
- `/red64:fix-tests "FAIL src/utils.test.ts..."` - Fix based on provided output

**Note**: This command is typically invoked automatically by the orchestrator when regression tests fail during implementation.
