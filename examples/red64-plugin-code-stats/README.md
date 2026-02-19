# red64-plugin-code-stats

A complete example plugin for red64-cli demonstrating commands, hooks, and services.

This plugin tracks code statistics during spec-driven development, automatically capturing metrics before and after implementation phases.

## Table of Contents

- [Project Structure](#project-structure)
- [File Descriptions](#file-descriptions)
- [Building the Plugin](#building-the-plugin)
- [Installing the Plugin](#installing-the-plugin)
- [Running Plugin Commands](#running-plugin-commands)
- [Managing the Plugin](#managing-the-plugin)
- [Configuration](#configuration)
- [How It Works](#how-it-works)

---

## Project Structure

```
red64-plugin-code-stats/
├── red64-plugin.json     # Plugin manifest (required)
├── package.json          # NPM package configuration
├── tsconfig.json         # TypeScript compiler settings
├── README.md             # This file
├── src/                  # Source code
│   ├── index.ts          # Plugin entry point
│   ├── plugin-types.ts   # Red64 plugin type definitions
│   ├── stats-service.ts  # Code analysis service
│   └── types.ts          # Plugin-specific type definitions
└── dist/                 # Compiled JavaScript (after build)
    ├── index.js
    ├── plugin-types.js
    ├── stats-service.js
    └── types.js
```

---

## File Descriptions

### `red64-plugin.json` (Required)

The plugin manifest that red64-cli uses to discover and validate the plugin:

```json
{
  "name": "code-stats",              // Unique plugin identifier
  "version": "1.0.0",                // Semver version
  "description": "...",              // Human-readable description
  "author": "...",                   // Author name/email
  "entryPoint": "dist/index.js",     // Path to compiled entry point
  "red64CliVersion": ">=0.12.0",     // Compatible CLI versions
  "extensionPoints": ["commands", "hooks", "services"],  // What this plugin provides
  "configSchema": { ... }            // Configuration options
}
```

### `package.json`

Standard NPM package file with:
- `"type": "module"` - ESM module format (required)
- `"keywords": ["red64-plugin"]` - Makes plugin discoverable via npm
- Build scripts for TypeScript compilation

### `tsconfig.json`

TypeScript configuration targeting ESM output:
- `"module": "NodeNext"` - ESM module system
- `"moduleResolution": "NodeNext"` - Node.js ESM resolution
- Outputs to `dist/` directory

### `src/index.ts` (Entry Point)

The main plugin file that exports:

```typescript
// Required: Called when plugin loads
export const activate = (context: PluginContextInterface) => {
  // Register commands, hooks, services here
};

// Optional: Called when plugin unloads
export const deactivate = () => {
  // Cleanup resources
};
```

### `src/stats-service.ts`

The code analysis service that:
- Walks directory trees
- Counts lines of code, comments, blanks
- Groups statistics by file extension
- Compares snapshots between phases

### `src/types.ts`

TypeScript interfaces for this plugin:
- `CodeStats` - Analysis results
- `FileStats` - Per-file metrics
- `StatsSnapshot` - Point-in-time capture
- `CodeStatsService` - Service interface

### `src/plugin-types.ts`

Red64 plugin type definitions. This file mirrors the types from `red64-cli/plugins`:
- `PluginModule` - Entry point interface
- `PluginContextInterface` - Plugin API surface
- `CommandRegistration`, `HookRegistration`, etc. - Extension point types

> **Note**: External plugins published to npm would import these types directly from `red64-cli/plugins`. This local copy is used because this example lives within the same repository.

---

## Building the Plugin

### Prerequisites

- Node.js 18+
- npm or pnpm

### Build Steps

```bash
# Navigate to the plugin directory
cd examples/red64-plugin-code-stats

# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run build
```

This creates the `dist/` directory with compiled `.js` files.

### Development Mode

For active development with auto-rebuild:

```bash
npm run dev
```

This watches for file changes and recompiles automatically.

---

## Installing the Plugin

### Install from Local Path

```bash
# Standard installation
red64 plugin install code-stats --local-path /path/to/red64-plugin-code-stats

# From the red64-cli project root
red64 plugin install code-stats --local-path ./examples/red64-plugin-code-stats
```

### Install with Dev Mode (Hot Reload)

```bash
red64 plugin install code-stats --local-path ./examples/red64-plugin-code-stats --dev
```

Dev mode enables hot reload - plugin reloads automatically when files change.

### Verify Installation

```bash
# List installed plugins
red64 plugin list

# Check plugin details
red64 plugin info code-stats
```

Expected output:
```
Installed Plugins:
  code-stats@1.0.0 (enabled)
    Track code statistics during spec-driven development
    Extension points: commands, hooks, services
```

---

## Running Plugin Commands

After installation, the plugin adds two commands:

### `red64 stats` - Analyze Code Statistics

```bash
# Analyze current directory
red64 stats

# Analyze specific directory
red64 stats ./src

# Output as JSON
red64 stats --format json
red64 stats -f json

# Output as Markdown
red64 stats --format markdown

# Include test files (if disabled in config)
red64 stats --include-tests
```

**Example Output:**

```
Code Statistics
══════════════════════════════════════════════════
Files:          42
Total Lines:    3847
Code Lines:     2891
Comment Lines:  412
Blank Lines:    544

By Extension:
──────────────────────────────────────────────────
  .ts         35 files,   2456 code lines
  .tsx         7 files,    435 code lines
══════════════════════════════════════════════════
```

### `red64 stats-compare` - Compare Phase Statistics

```bash
# Compare stats captured during workflow phases
red64 stats-compare my-feature
```

**Example Output:**

```
Statistics for feature: my-feature

Phase Progression:
────────────────────────────────────────────────────────────

pre-implementation → post-implementation:
  Files:      +5
  Lines:      +342
  Code Lines: +287

────────────────────────────────────────────────────────────
```

---

## Managing the Plugin

### List Plugins

```bash
red64 plugin list
```

### View Plugin Info

```bash
red64 plugin info code-stats
```

### Disable Plugin

Temporarily disable without uninstalling:

```bash
red64 plugin disable code-stats
```

The plugin remains installed but won't load on startup.

### Enable Plugin

Re-enable a disabled plugin:

```bash
red64 plugin enable code-stats
```

### Update Plugin

Update to the latest version:

```bash
red64 plugin update code-stats
```

### Uninstall Plugin

Remove the plugin completely:

```bash
red64 plugin uninstall code-stats
```

### Validate Plugin

Check a plugin for errors before installing:

```bash
red64 plugin validate ./examples/red64-plugin-code-stats
```

---

## Configuration

### View Current Config

```bash
red64 plugin config code-stats
```

### Set Configuration Values

```bash
# Exclude test files from analysis
red64 plugin config code-stats includeTests false

# Change analyzed file extensions
red64 plugin config code-stats extensions '[".ts", ".py", ".go"]'

# Set default output format
red64 plugin config code-stats outputFormat json
```

### Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeTests` | boolean | `true` | Include `*.test.*` and `*.spec.*` files |
| `extensions` | array | `[".ts", ".tsx", ".js", ".jsx"]` | File extensions to analyze |
| `outputFormat` | string | `"table"` | Default format: `table`, `json`, or `markdown` |

---

## How It Works

### Extension Points Used

This plugin demonstrates three extension points:

#### 1. Commands

Registers CLI commands via `context.registerCommand()`:

```typescript
context.registerCommand({
  name: 'stats',
  description: 'Analyze code statistics',
  args: [{ name: 'directory', required: false, description: '...' }],
  options: [{ name: 'format', type: 'string', alias: 'f' }],
  handler: async (args) => { /* ... */ }
});
```

#### 2. Hooks

Registers workflow phase hooks via `context.registerHook()`:

```typescript
context.registerHook({
  phase: 'implementation',
  timing: 'pre',              // Run before phase
  priority: 'early',          // Run early in hook order
  handler: async (ctx) => {
    // Capture baseline stats
    return { action: 'continue' };
  }
});
```

#### 3. Services

Registers a shared service via `context.registerService()`:

```typescript
context.registerService({
  name: 'code-stats',
  factory: () => statsService,
  dispose: () => { /* cleanup */ }
});
```

Other plugins can then access this service:

```typescript
const stats = context.getService<CodeStatsService>('code-stats');
```

### Automatic Statistics Capture

During the red64 workflow:

1. **Pre-implementation hook**: Captures baseline code statistics
2. **You implement the feature**: Write code, add files, etc.
3. **Post-implementation hook**: Captures final statistics and displays diff

```
📊 Implementation Statistics:
   Files changed: +5 / -0
   Lines changed: +342 / -12
   Code lines:    +287 / -8
```

---

## Troubleshooting

### Plugin Not Found

Ensure you built the plugin first:

```bash
cd examples/red64-plugin-code-stats
npm run build
```

### Commands Not Available

Check the plugin is enabled:

```bash
red64 plugin list
red64 plugin enable code-stats
```

### Type Errors During Build

Ensure `red64-cli` types are available:

```bash
npm install red64-cli --save-dev
```

Or use the types from the parent project during development.

---

## Learn More

- [Plugin Development Guide](../../plugin-how-to.md) - Full documentation
- [Plugin Types](../../src/plugins/types.ts) - TypeScript interfaces
- [red64-cli Documentation](../../README.md) - CLI usage
