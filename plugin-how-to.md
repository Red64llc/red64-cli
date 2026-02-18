# Red64 Plugin Development Guide

This guide covers how to create, install, and manage plugins for red64-cli.

## Table of Contents

- [Plugin Overview](#plugin-overview)
- [Creating a Plugin](#creating-a-plugin)
- [Plugin Manifest](#plugin-manifest)
- [Extension Points](#extension-points)
- [Installing Plugins](#installing-plugins)
- [Managing Plugins](#managing-plugins)
- [Plugin Configuration](#plugin-configuration)
- [Development Mode](#development-mode)

## Plugin Overview

Red64 plugins extend the CLI with custom commands, agents, hooks, services, and templates. Plugins are ESM modules that export an `activate` function and include a `red64-plugin.json` manifest.

### Extension Points

| Extension Point | Description |
|-----------------|-------------|
| `commands` | Add custom CLI commands |
| `agents` | Register custom AI agents |
| `hooks` | Execute code before/after workflow phases |
| `services` | Provide shared services with dependency injection |
| `templates` | Add custom stack, spec, or steering templates |

## Creating a Plugin

### Quick Start

```bash
red64 plugin create my-plugin
```

This scaffolds a new plugin with the required structure.

### Manual Setup

Create a directory with the following structure:

```
my-plugin/
├── red64-plugin.json    # Plugin manifest (required)
├── package.json         # NPM package file
├── dist/
│   └── index.js         # Compiled entry point
└── src/
    └── index.ts         # Source entry point
```

### Entry Point

Your plugin must export an `activate` function:

```typescript
import type { PluginContextInterface, PluginModule } from 'red64-cli/plugins';

export const activate: PluginModule['activate'] = (context) => {
  // Register extensions here
  context.log('info', `Plugin ${context.pluginName} activated`);
};

// Optional: cleanup when plugin is unloaded
export const deactivate: PluginModule['deactivate'] = () => {
  // Cleanup resources
};
```

## Plugin Manifest

Create `red64-plugin.json` in your plugin root:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome red64 plugin",
  "author": "Your Name",
  "entryPoint": "dist/index.js",
  "red64CliVersion": ">=0.12.0",
  "extensionPoints": ["commands", "hooks"],
  "dependencies": [],
  "configSchema": {
    "apiKey": {
      "type": "string",
      "description": "API key for external service",
      "required": false
    },
    "maxRetries": {
      "type": "number",
      "description": "Maximum retry attempts",
      "default": 3
    }
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique plugin identifier |
| `version` | string | Yes | Semver version (e.g., `1.0.0`) |
| `description` | string | Yes | Brief description |
| `author` | string | Yes | Author name or email |
| `entryPoint` | string | Yes | Path to compiled JS entry point |
| `red64CliVersion` | string | Yes | Semver range of compatible CLI versions |
| `extensionPoints` | array | Yes | Extension points this plugin uses |
| `dependencies` | array | No | Other plugins this depends on |
| `configSchema` | object | No | Configuration field definitions |

## Extension Points

### Commands

Register custom CLI commands:

```typescript
context.registerCommand({
  name: 'my-command',
  description: 'Does something useful',
  args: [
    { name: 'target', description: 'Target to process', required: true }
  ],
  options: [
    { name: 'verbose', description: 'Enable verbose output', type: 'boolean', alias: 'v' },
    { name: 'output', description: 'Output file path', type: 'string', default: './out' }
  ],
  handler: async (args) => {
    const target = args.positional[0];
    const verbose = args.options['verbose'] as boolean;

    if (verbose) {
      args.context.log('info', `Processing ${target}...`);
    }

    // Command logic here
  }
});
```

Usage: `red64 my-command target-name --verbose`

### Agents

Register custom AI agents:

```typescript
context.registerAgent({
  name: 'my-agent',
  description: 'Custom AI agent for specific tasks',
  adapter: {
    async invoke(options) {
      // Call your AI service
      const response = await myAIService.generate({
        prompt: options.prompt,
        model: options.model
      });

      return {
        success: true,
        output: response.text
      };
    },

    getCapabilities() {
      return ['code-generation', 'code-review'];
    },

    configure(config) {
      // Apply configuration
    }
  }
});
```

Agent capabilities: `code-generation`, `code-review`, `testing`, `documentation`, `refactoring`

### Hooks

Execute code before or after workflow phases:

```typescript
context.registerHook({
  phase: 'implementation',  // or 'requirements', 'design', 'tasks', '*' (all)
  timing: 'pre',            // 'pre' or 'post'
  priority: 'normal',       // 'earliest', 'early', 'normal', 'late', 'latest'
  handler: async (hookContext) => {
    // Access phase metadata
    console.log(`Feature: ${hookContext.feature}`);
    console.log(`Phase: ${hookContext.phase}`);

    // Return continue or veto
    if (someConditionFails) {
      return { action: 'veto', reason: 'Validation failed' };
    }

    return { action: 'continue' };
  }
});
```

Hook context provides:
- `phase`: Current workflow phase
- `timing`: Whether this is pre or post phase
- `feature`: Feature name being processed
- `specMetadata`: Read-only spec metadata
- `flowState`: Read-only flow state

### Services

Provide shared services with lazy instantiation and dependency injection:

```typescript
context.registerService({
  name: 'my-database',
  dependencies: ['logger'],  // Other services this depends on
  factory: (resolved) => {
    const logger = resolved['logger'] as Logger;
    return new DatabaseService(logger);
  },
  dispose: async () => {
    // Cleanup when plugin unloads
    await db.close();
  }
});

// Use services from other plugins
const db = context.getService<DatabaseService>('my-database');
```

### Templates

Add custom templates for stacks, specs, or steering:

```typescript
context.registerTemplate({
  category: 'stack',      // 'stack', 'spec', or 'steering'
  name: 'nextjs-prisma',
  description: 'Next.js with Prisma ORM template',
  sourcePath: './templates/nextjs-prisma',
  subType: undefined      // For 'spec': 'requirements', 'design', or 'tasks'
});
```

Templates are automatically namespaced as `pluginName/templateName`.

## Installing Plugins

### From NPM

```bash
red64 plugin install my-plugin
```

### From Local Path

```bash
red64 plugin install my-plugin --local-path /path/to/plugin
```

### From Custom Registry

```bash
red64 plugin install my-plugin --registry https://my-registry.com
```

### Validate Before Installing

```bash
red64 plugin validate /path/to/plugin
```

## Managing Plugins

### List Installed Plugins

```bash
red64 plugin list
```

### Enable/Disable Plugins

```bash
red64 plugin enable my-plugin
red64 plugin disable my-plugin
```

### Update Plugins

```bash
red64 plugin update my-plugin
```

### Uninstall Plugins

```bash
red64 plugin uninstall my-plugin
```

### View Plugin Info

```bash
red64 plugin info my-plugin
```

### Search Plugin Registry

```bash
red64 plugin search "code review"
```

## Plugin Configuration

### View Configuration

```bash
red64 plugin config my-plugin
```

### Set Configuration Value

```bash
red64 plugin config my-plugin apiKey "sk-xxx"
red64 plugin config my-plugin maxRetries 5
```

### Access Config in Code

```typescript
export const activate = (context: PluginContextInterface) => {
  // Config is already resolved with defaults applied
  const apiKey = context.config['apiKey'] as string;
  const maxRetries = context.config['maxRetries'] as number;
};
```

## Development Mode

Enable hot reload during development:

```bash
red64 plugin install my-plugin --local-path ./my-plugin --dev
```

In dev mode:
- Plugin reloads automatically when files change
- Source maps are preserved for debugging
- Warnings appear after excessive reloads (>10) due to ESM cache growth

### Plugin Context API

The `PluginContextInterface` provides:

```typescript
interface PluginContextInterface {
  // Identity
  readonly pluginName: string;
  readonly pluginVersion: string;

  // Configuration (frozen, defaults merged)
  readonly config: Record<string, unknown>;

  // Extension registration
  registerCommand(registration: CommandRegistration): void;
  registerAgent(registration: AgentRegistration): void;
  registerHook(registration: HookRegistration): void;
  registerService(registration: ServiceRegistration): void;
  registerTemplate(registration: TemplateRegistration): void;

  // Service resolution
  getService<T>(serviceName: string): T;
  hasService(serviceName: string): boolean;

  // Utilities
  log(level: 'info' | 'warn' | 'error', message: string): void;

  // Read-only core access
  getCLIVersion(): string;
  getProjectConfig(): Record<string, unknown> | null;
}
```

## Publishing to NPM

To make your plugin discoverable:

1. Add `red64-plugin` keyword to `package.json`:

```json
{
  "name": "my-red64-plugin",
  "keywords": ["red64-plugin"]
}
```

2. Include the manifest in your package:

```json
{
  "files": ["dist", "red64-plugin.json"]
}
```

3. Publish:

```bash
npm publish
```

## Error Handling

Plugins should never crash the host CLI. Wrap risky operations:

```typescript
context.registerCommand({
  name: 'risky-command',
  description: 'Command that might fail',
  handler: async (args) => {
    try {
      await riskyOperation();
    } catch (error) {
      args.context.log('error', `Operation failed: ${error.message}`);
      // Don't re-throw - handle gracefully
    }
  }
});
```

## Best Practices

1. **Use TypeScript** - Catch errors at compile time
2. **Validate inputs** - Don't trust user input or external data
3. **Handle errors gracefully** - Log and continue, don't crash the CLI
4. **Clean up resources** - Implement `deactivate` for cleanup
5. **Document configuration** - Use `configSchema` with descriptions
6. **Test your plugin** - Write unit and integration tests
7. **Follow semver** - Use proper versioning for compatibility
8. **Declare dependencies** - List plugin dependencies in manifest
