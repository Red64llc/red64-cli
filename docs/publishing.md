# Publishing red64-cli to npm

This guide covers publishing red64-cli as an npm package that users can run with `npx red64`.

## Prerequisites

- Node.js >= 20.0.0
- npm account (create at https://www.npmjs.com/signup)
- npm CLI logged in (`npm login`)

## Package Configuration

The `package.json` is already configured for publishing:

```json
{
  "name": "red64-cli",
  "version": "0.1.0",
  "bin": {
    "red64": "./dist/cli.js"
  },
  "files": [
    "dist",
    "framework"
  ],
  "engines": {
    "node": ">=20.0.0"
  }
}
```

Key fields:
- **bin**: Maps `red64` command to compiled entry point
- **files**: Includes `dist/` (compiled code) and `framework/` (agent templates)
- **engines**: Enforces Node.js version requirement

## Pre-Publish Checklist

### 1. Build the Project

```bash
npm run build
```

This runs:
- `build:framework` - Processes framework templates
- `tsc` - Compiles TypeScript to `dist/`

### 2. Verify Build Output

```bash
# Check dist exists
ls dist/cli.js

# Check framework is complete
ls framework/agents/
ls framework/.red64/
```

### 3. Test Locally with npm link

```bash
# Create global symlink
npm link

# Test the command
red64 --version
red64 --help

# Test init in a temp directory
cd /tmp && mkdir test-project && cd test-project
red64 init

# Cleanup
npm unlink -g red64-cli
```

### 4. Test with Local npx

```bash
# Pack the package locally
npm pack

# Test with npx (use the generated .tgz file)
npx ./red64-cli-0.1.0.tgz --help

# Or install globally from tarball
npm install -g ./red64-cli-0.1.0.tgz
red64 --version
```

### 5. Dry Run Publish

```bash
npm publish --dry-run
```

Review the output to ensure:
- Only intended files are included
- Package size is reasonable
- No sensitive files leak (check `.npmignore` or `files` field)

## Publishing

### First-Time Publish

```bash
# Login to npm (if not already)
npm login

# Publish (public package)
npm publish --access public
```

### Subsequent Releases

```bash
# Bump version (choose one)
npm version patch  # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor  # 0.1.0 -> 0.2.0 (new features)
npm version major  # 0.1.0 -> 1.0.0 (breaking changes)

# Build and publish
npm run build
npm publish
```

## User Installation

After publishing, users can:

```bash
# Run directly with npx (no install)
npx red64 init
npx red64 start my-feature "Add user auth"

# Or install globally
npm install -g red64-cli
red64 init
```

## Package Naming Considerations

If `red64-cli` is taken on npm, options:

1. **Scoped package**: `@yourorg/red64-cli`
   ```json
   { "name": "@yourorg/red64-cli" }
   ```
   Users run: `npx @yourorg/red64-cli` or `npx @yourorg/red64`

2. **Alternative name**: `red64-flow`, `red64-dev`, etc.

3. **Claim the name**: Register the package early, even with a placeholder version

## .npmignore (Optional)

If you need more control than the `files` field, create `.npmignore`:

```
# Source files (not needed, dist is compiled)
src/
tests/

# Development files
*.test.ts
*.spec.ts
vitest.config.ts
tsconfig.json

# Documentation (optional to exclude)
docs/

# IDE and OS
.idea/
.vscode/
.DS_Store

# Git
.git/
.gitignore

# Specs (development only)
.kiro/
.red64/

# Scripts
scripts/
```

Note: The `files` field in `package.json` is usually sufficient and acts as an allowlist.

## Verify Published Package

After publishing:

```bash
# Check package info
npm info red64-cli

# Test installation
npx red64-cli@latest --version

# View package contents
npm pack red64-cli --dry-run
```

## CI/CD Publishing (GitHub Actions)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test

      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Setup:
1. Generate npm token: https://www.npmjs.com/settings/~/tokens
2. Add `NPM_TOKEN` to GitHub repository secrets
3. Create a GitHub release to trigger publish

## Version Management

Follow semantic versioning:

- **Patch** (0.1.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

For pre-release versions:
```bash
npm version prerelease --preid=beta  # 0.1.0 -> 0.1.1-beta.0
npm publish --tag beta               # Users: npx red64-cli@beta
```

## Troubleshooting

### "Package name already exists"
- Use a scoped package: `@yourorg/red64-cli`
- Or choose a different name

### "You must be logged in"
```bash
npm login
npm whoami  # Verify login
```

### "Cannot find module" after install
- Ensure `dist/cli.js` exists and has shebang: `#!/usr/bin/env node`
- Check `files` field includes `dist`

### Binary not executable
```bash
chmod +x dist/cli.js
```
(Should be automatic, but verify if issues)

### Framework files missing
- Ensure `files` field includes `framework`
- Check `framework/` directory exists after build

## Quick Reference

```bash
# Development
npm run dev          # Run from source with tsx
npm run build        # Build for production
npm test             # Run tests

# Local testing
npm link             # Create global symlink
npm unlink -g red64-cli  # Remove symlink
npm pack             # Create tarball for testing

# Publishing
npm login            # Authenticate
npm publish --dry-run    # Preview
npm publish --access public  # Publish
npm version patch    # Bump version

# Verification
npm info red64-cli   # View published info
npx red64-cli@latest --version  # Test latest
```
