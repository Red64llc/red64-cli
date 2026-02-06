# Release Process

This document describes how to create a new release for red64-cli.

## Quick Release (Script)

```bash
./scripts/release.sh <patch|minor|major>
```

The script handles all steps automatically. See below for manual process.

---

## Manual Release Process

### 1. Pre-flight Checks

```bash
# Ensure working directory is clean
git status

# Ensure you're on main branch
git checkout main
git pull origin main

# Run tests
CI=true npm run test:run

# Run type check
npm run type-check

# Build the project
npm run build
```

### 2. Update RELEASE.md

Review commits since last release and update `RELEASE.md`:

```bash
# Get commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges | grep -v "WIP:"
```

Update `RELEASE.md` with:
- New features
- Bug fixes
- Breaking changes (if any)
- Internal/maintenance changes

### 3. Bump Version in package.json

```bash
# For bug fixes (0.9.0 -> 0.9.1)
npm version patch --no-git-tag-version

# For new features (0.9.0 -> 0.10.0)
npm version minor --no-git-tag-version

# For breaking changes (0.9.0 -> 1.0.0)
npm version major --no-git-tag-version
```

### 4. Commit Version Bump

```bash
git add package.json package-lock.json RELEASE.md
git commit -m "chore(release): vX.Y.Z"
```

### 5. Create Git Tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 6. Push to Remote

```bash
# Push commits
git push origin main

# Push tag
git push origin vX.Y.Z
```

### 7. Create GitHub Release

Using GitHub CLI:
```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file RELEASE.md
```

Or manually:
1. Go to https://github.com/Red64llc/red64-cli/releases/new
2. Select the tag `vX.Y.Z`
3. Set title to `vX.Y.Z`
4. Copy contents of `RELEASE.md` into description
5. Click "Publish release"

### 8. Publish to npm (Optional)

```bash
# Ensure you're logged in
npm whoami

# Publish
npm publish
```

---

## Version Guidelines

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, patches | `patch` | 0.9.0 → 0.9.1 |
| New features (backward compatible) | `minor` | 0.9.0 → 0.10.0 |
| Breaking changes | `major` | 0.9.0 → 1.0.0 |

## Checklist

- [ ] All tests pass
- [ ] Type check passes
- [ ] Build succeeds
- [ ] RELEASE.md is updated
- [ ] Version bumped in package.json
- [ ] Changes committed
- [ ] Git tag created
- [ ] Pushed to remote (commits + tag)
- [ ] GitHub release created
- [ ] Published to npm (if applicable)
