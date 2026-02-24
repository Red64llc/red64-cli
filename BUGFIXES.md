# red64 start — Windows Bug Fixes

Summary of all issues discovered and fixed while debugging `red64 start` on Windows.

---

## Bug 1: Health check timeout too short

**Symptom**: `red64 start` hangs and then fails during the initial Claude API health check.

**Root cause**: `claude.exe` on Windows is ~235MB. Windows Defender scans it on first launch (cold start), causing startup to exceed 30 seconds. The health check timeout was set to 30s.

**Fix**: Increased health check timeout from 30s to 60s.

**File**: `src/services/ClaudeHealthCheck.ts`

---

## Bug 2: Framework skills missing in worktree ("Unknown skill")

**Symptom**: Flow log shows `Unknown skill: red64:spec-requirements`. Claude CLI runs but cannot find any `/red64:*` skills.

**Root cause**: `red64 start` creates a git worktree at `../repo.worktrees/feature-name/`. Git worktrees only contain tracked files. If the user never ran `red64 init` (or init's auto-commit of `.claude/` failed), the `.claude/commands/red64/*.md` skill files don't exist in the worktree. Claude CLI discovers skills by scanning `.claude/commands/` on the filesystem.

**Fix**: After worktree creation and before the first Claude invocation, check if `.claude/commands/red64/` exists. If missing, call `templateService.installFramework()` to copy the bundled framework into the worktree, then commit it.

**Files**:
- `src/components/screens/StartScreen.tsx` — added framework installation after worktree creation
- `src/utils/paths.ts` — extracted `getBundledFrameworkPath()` as shared utility
- `src/components/screens/InitScreen.tsx` — replaced local function with shared import

---

## Bug 3: `getBundledFrameworkPath()` returns invalid path on Windows

**Symptom**: Framework installation runs ("Installing framework skills...") but no files are created. Commit fails with "nothing to commit". Skills still not found.

**Root cause**: The original implementation used `new URL(import.meta.url).pathname` which on Windows returns `/C:/git/red64-cli/...` (with a leading `/`). This is NOT a valid Windows filesystem path. `path.join` turns it into `\C:\git\...\` which is also invalid. `existsSync('/C:/git/red64-cli/framework')` returns `false`, so `installFramework()` silently skips the copy.

**Fix**: Changed to `fileURLToPath(import.meta.url)` from `node:url` which correctly returns `C:\git\red64-cli\...` on Windows. Also uses `path.sep` for platform-aware marker splitting.

**File**: `src/utils/paths.ts`

```typescript
// Before (broken on Windows):
const modulePath = new URL(import.meta.url).pathname;
const rootDir = modulePath.includes('/dist/')
  ? modulePath.split('/dist/')[0]
  : modulePath.split('/src/')[0];

// After (works on all platforms):
const modulePath = fileURLToPath(import.meta.url);
const distMarker = `${sep}dist${sep}`;
const srcMarker = `${sep}src${sep}`;
const rootDir = modulePath.includes(distMarker)
  ? modulePath.split(distMarker)[0]
  : modulePath.split(srcMarker)[0];
```

---

## Bug 4: Claude CLI cannot write files in non-interactive mode

**Symptom**: Requirements generation runs for ~7 minutes, successfully generates 48 acceptance criteria, but Claude responds with "write permissions are being blocked" and never saves the files.

**Root cause**: `red64 start` spawns `claude -p "/red64:spec-requirements ..."` which runs non-interactively. Without `--dangerously-skip-permissions`, Claude CLI cannot write files because it would need to prompt for user approval — but there is no interactive terminal. The `skipPermissions` flag defaulted to `false` and required the user to explicitly pass `red64 start -s`, which is unintuitive since the entire flow is inherently non-interactive.

**Fix**: Added an interactive confirmation prompt at flow start. After health check and test checks pass, if the user didn't pass `-s` / `--skip-permissions`, the flow pauses and displays:

```
Write Permissions Required
The automated flow runs Claude non-interactively and needs
file write access (--dangerously-skip-permissions).
Tip: use `red64 start -s` to skip this prompt.

> Yes, allow file writes (--dangerously-skip-permissions)
  No, cancel
```

If the user approves, `permissionsApprovedRef` is set and all subsequent agent invocations include `--dangerously-skip-permissions`. If `-s` was passed on the command line, the prompt is skipped entirely.

**File**: `src/components/screens/StartScreen.tsx`
- Added `PreStartStep` variant: `'permissions-prompt'`
- Added `permissionsApprovedRef` to track approval state
- Split `startFreshFlow` into pre/post permissions checkpoint (`continueFlowAfterPermissions`)
- Added `handlePermissionsDecision` handler and `Select` UI for the prompt
- Agent invocations use `skipPermissions: permissionsApprovedRef.current`

---

## Test fixes (Windows compatibility)

Several pre-existing tests failed on Windows due to platform assumptions:

| File | Issue | Fix |
|------|-------|-----|
| `tests/services/WorktreeService.test.ts` | Hardcoded `/` path separators in expected values | Used `join()`, `dirname()`, `basename()` for platform-aware assertions |
| `tests/services/TaskParser.test.ts` | Hardcoded `/` in expected file path | Used `join()` for expected path |
| `tests/services/PreviewService.test.ts` | `chmod(0o000)` doesn't block reads on NTFS | Added `it.skipIf(process.platform === 'win32')` |
| `tests/components/screens/StartScreen.test.tsx` | Missing `createTemplateService` mock | Added mock for new service dependency |
