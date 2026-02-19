/**
 * PluginScreen - Plugin management UI component
 * Task 10.1: Full implementation of plugin management UI
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.1, 11.1, 11.2, 12.1, 12.4
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { Spinner } from '@inkjs/ui';
import type { GlobalFlags } from '../../types/index.js';
import {
  createPluginManager,
  type PluginManagerService,
  type InstallStep,
  type PluginInfo,
  type PluginDetail,
  type RegistryEntry,
} from '../../plugins/PluginManager.js';
import { createPluginRegistry } from '../../plugins/PluginRegistry.js';
import { createManifestValidator } from '../../plugins/ManifestValidator.js';
import type { ManifestValidationResult, ManifestError } from '../../plugins/types.js';

/**
 * Props for PluginScreen
 */
export interface PluginScreenProps {
  readonly args: readonly string[];
  readonly flags: GlobalFlags;
}

/**
 * Subcommand type for plugin commands
 */
type PluginSubcommand =
  | 'install'
  | 'uninstall'
  | 'enable'
  | 'disable'
  | 'list'
  | 'update'
  | 'search'
  | 'info'
  | 'config'
  | 'create'
  | 'validate'
  | 'help';

/**
 * State for async operations
 */
type PluginScreenState =
  | { step: 'idle' }
  | { step: 'loading'; message: string }
  | { step: 'progress'; phase: string; progress?: number }
  | { step: 'success'; message: string; data?: unknown }
  | { step: 'error'; message: string };

/**
 * Get base directory (project root)
 */
function getBaseDir(): string {
  return process.cwd();
}

/**
 * Get node_modules directory
 */
function getNodeModulesDir(): string {
  return `${process.cwd()}/node_modules`;
}

/**
 * Get CLI version (placeholder - should come from package.json)
 */
function getCLIVersion(): string {
  return '1.0.0';
}

/**
 * Create plugin manager instance
 */
function createManager(): PluginManagerService {
  const registry = createPluginRegistry();
  const validator = createManifestValidator();

  return createPluginManager({
    registry,
    validator,
    projectDir: getBaseDir(),
    nodeModulesDir: getNodeModulesDir(),
    cliVersion: getCLIVersion(),
  });
}

/**
 * Plugin management screen component
 * Handles the `red64 plugin` command group
 */
export const PluginScreen: React.FC<PluginScreenProps> = ({ args, flags }) => {
  const [state, setState] = useState<PluginScreenState>({ step: 'idle' });
  const [manager] = useState<PluginManagerService>(() => createManager());

  const subcommand = (args[0] ?? 'help') as PluginSubcommand;
  const pluginArg = args[1];
  const extraArg1 = args[2];
  const extraArg2 = args[3];

  // Handle async operations
  useEffect(() => {
    const runCommand = async (): Promise<void> => {
      try {
        switch (subcommand) {
          case 'list':
            await handleList();
            break;
          case 'install':
            if (pluginArg) {
              await handleInstall(pluginArg);
            }
            break;
          case 'uninstall':
            if (pluginArg) {
              await handleUninstall(pluginArg);
            }
            break;
          case 'enable':
            if (pluginArg) {
              await handleEnable(pluginArg);
            }
            break;
          case 'disable':
            if (pluginArg) {
              await handleDisable(pluginArg);
            }
            break;
          case 'update':
            if (pluginArg) {
              await handleUpdate(pluginArg);
            }
            break;
          case 'search':
            if (pluginArg) {
              await handleSearch(pluginArg);
            }
            break;
          case 'info':
            if (pluginArg) {
              await handleInfo(pluginArg);
            }
            break;
          case 'config':
            if (pluginArg) {
              await handleConfig(pluginArg, extraArg1, extraArg2);
            }
            break;
          case 'create':
            if (pluginArg) {
              await handleCreate(pluginArg);
            }
            break;
          case 'validate':
            if (pluginArg) {
              await handleValidate(pluginArg);
            }
            break;
          default:
            // Help and other commands don't need async handling
            break;
        }
      } catch (err) {
        setState({
          step: 'error',
          message: err instanceof Error ? err.message : 'Unknown error occurred',
        });
      }
    };

    // Only run for commands that need async handling and have required args
    const needsAsync =
      subcommand === 'list' ||
      (subcommand === 'install' && pluginArg) ||
      (subcommand === 'uninstall' && pluginArg) ||
      (subcommand === 'enable' && pluginArg) ||
      (subcommand === 'disable' && pluginArg) ||
      (subcommand === 'update' && pluginArg) ||
      (subcommand === 'search' && pluginArg) ||
      (subcommand === 'info' && pluginArg) ||
      (subcommand === 'config' && pluginArg) ||
      (subcommand === 'create' && pluginArg) ||
      (subcommand === 'validate' && pluginArg);

    if (needsAsync && state.step === 'idle') {
      setState({ step: 'loading', message: 'Starting...' });
      runCommand();
    }
  }, [subcommand, pluginArg, extraArg1, extraArg2, state.step, manager, flags]);

  // ---------------------------------------------------------------------------
  // Command Handlers
  // ---------------------------------------------------------------------------

  const handleList = async (): Promise<void> => {
    setState({ step: 'loading', message: 'Loading plugins...' });
    const plugins = await manager.list();
    setState({ step: 'success', message: 'list', data: plugins });
  };

  const handleInstall = async (name: string): Promise<void> => {
    setState({ step: 'progress', phase: 'downloading', progress: 0 });

    const onProgress = (step: InstallStep): void => {
      setState({ step: 'progress', phase: step.phase, progress: 'progress' in step ? step.progress : undefined });
    };

    const result = await manager.install(name, {
      registryUrl: flags.registry,
      localPath: flags['local-path'],
      onProgress,
    });

    if (result.success) {
      setState({
        step: 'success',
        message: `Successfully installed ${result.pluginName}@${result.version}`,
      });
    } else {
      setState({
        step: 'error',
        message: result.error ?? 'Installation failed',
      });
    }
  };

  const handleUninstall = async (name: string): Promise<void> => {
    setState({ step: 'loading', message: `Uninstalling ${name}...` });
    const result = await manager.uninstall(name);

    if (result.success) {
      setState({
        step: 'success',
        message: `Successfully uninstalled ${result.pluginName}`,
      });
    } else {
      setState({
        step: 'error',
        message: result.error ?? 'Uninstall failed',
      });
    }
  };

  const handleEnable = async (name: string): Promise<void> => {
    setState({ step: 'loading', message: `Enabling ${name}...` });
    await manager.enable(name);
    setState({
      step: 'success',
      message: `Plugin ${name} enabled successfully`,
    });
  };

  const handleDisable = async (name: string): Promise<void> => {
    setState({ step: 'loading', message: `Disabling ${name}...` });
    await manager.disable(name);
    setState({
      step: 'success',
      message: `Plugin ${name} disabled successfully`,
    });
  };

  const handleUpdate = async (name: string): Promise<void> => {
    setState({ step: 'progress', phase: 'updating' });
    const result = await manager.update(name);

    if (result.success) {
      setState({
        step: 'success',
        message: `Successfully updated ${result.pluginName} from ${result.previousVersion} to ${result.newVersion}`,
      });
    } else {
      setState({
        step: 'error',
        message: result.error ?? 'Update failed',
      });
    }
  };

  const handleSearch = async (query: string): Promise<void> => {
    setState({ step: 'loading', message: `Searching for "${query}"...` });
    const results = await manager.search(query, { registryUrl: flags.registry });
    setState({ step: 'success', message: 'search', data: results });
  };

  const handleInfo = async (name: string): Promise<void> => {
    setState({ step: 'loading', message: `Fetching info for ${name}...` });
    const info = await manager.info(name, { registryUrl: flags.registry });
    setState({ step: 'success', message: 'info', data: info });
  };

  const handleConfig = async (name: string, key?: string, value?: string): Promise<void> => {
    setState({ step: 'loading', message: `Loading config for ${name}...` });

    if (key && value) {
      // Set config
      await manager.setConfig(name, key, value);
      setState({
        step: 'success',
        message: `Configuration ${key} set successfully for ${name}`,
      });
    } else {
      // Get config
      const config = await manager.getConfig(name, key);
      setState({ step: 'success', message: 'config', data: config });
    }
  };

  const handleCreate = async (name: string): Promise<void> => {
    setState({ step: 'loading', message: `Scaffolding plugin ${name}...` });
    const result = await manager.scaffold(name, getBaseDir());

    if (result.success) {
      setState({
        step: 'success',
        message: `Plugin ${name} created successfully`,
        data: result.createdFiles,
      });
    } else {
      setState({
        step: 'error',
        message: result.error ?? 'Scaffold failed',
      });
    }
  };

  const handleValidate = async (pluginPath: string): Promise<void> => {
    setState({ step: 'loading', message: `Validating plugin at ${pluginPath}...` });
    const result = await manager.validate(pluginPath);
    setState({ step: 'success', message: 'validate', data: result });
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderPluginTable = (plugins: readonly PluginInfo[]): React.ReactNode => {
    if (plugins.length === 0) {
      return <Text color="gray">No plugins installed.</Text>;
    }

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            <Text color="cyan">{'NAME'.padEnd(25)}</Text>
            <Text color="cyan">{'VERSION'.padEnd(12)}</Text>
            <Text color="cyan">{'STATUS'.padEnd(10)}</Text>
            <Text color="cyan">EXTENSIONS</Text>
          </Text>
        </Box>
        {plugins.map((plugin) => (
          <Text key={plugin.name}>
            <Text>{plugin.name.padEnd(25)}</Text>
            <Text>{plugin.version.padEnd(12)}</Text>
            <Text color={plugin.enabled ? 'green' : 'yellow'}>{(plugin.enabled ? 'enabled' : 'disabled').padEnd(10)}</Text>
            <Text color="gray">{plugin.extensionPoints.join(', ')}</Text>
          </Text>
        ))}
      </Box>
    );
  };

  const renderSearchResults = (results: readonly RegistryEntry[]): React.ReactNode => {
    if (results.length === 0) {
      return <Text color="gray">No plugins found matching your query.</Text>;
    }

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            <Text color="cyan">{'NAME'.padEnd(30)}</Text>
            <Text color="cyan">{'VERSION'.padEnd(12)}</Text>
            <Text color="cyan">DESCRIPTION</Text>
          </Text>
        </Box>
        {results.map((entry) => (
          <Text key={entry.name}>
            <Text>{entry.name.padEnd(30)}</Text>
            <Text>{entry.version.padEnd(12)}</Text>
            <Text color="gray">{entry.description.slice(0, 40)}{entry.description.length > 40 ? '...' : ''}</Text>
          </Text>
        ))}
      </Box>
    );
  };

  const renderPluginDetail = (info: PluginDetail | null): React.ReactNode => {
    if (!info) {
      return <Text color="red">Plugin not found. Could not find plugin in local installation or registry.</Text>;
    }

    return (
      <Box flexDirection="column">
        <Text bold color="cyan">{info.name}</Text>
        <Text />
        <Text><Text bold>Version:</Text> {info.version}</Text>
        <Text><Text bold>Author:</Text> {info.author}</Text>
        <Text><Text bold>Description:</Text> {info.description}</Text>
        <Text><Text bold>Status:</Text> <Text color={info.enabled ? 'green' : 'yellow'}>{info.enabled ? 'enabled' : 'not installed'}</Text></Text>
        <Text><Text bold>Compatibility:</Text> {info.compatibilityRange}</Text>
        <Text><Text bold>Extensions:</Text> {info.extensionPoints.join(', ')}</Text>
        {info.dependencies.length > 0 && (
          <Text><Text bold>Dependencies:</Text> {info.dependencies.join(', ')}</Text>
        )}
        {info.configSchema && Object.keys(info.configSchema).length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Configuration:</Text>
            {Object.entries(info.configSchema).map(([key, schema]) => (
              <Text key={key} color="gray">  {key}: {typeof schema === 'object' && schema !== null && 'type' in schema ? String((schema as { type: unknown }).type) : 'unknown'}</Text>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderConfig = (config: Record<string, unknown>): React.ReactNode => {
    const entries = Object.entries(config);
    if (entries.length === 0) {
      return <Text color="gray">No configuration set.</Text>;
    }

    return (
      <Box flexDirection="column">
        {entries.map(([key, value]) => (
          <Text key={key}>
            <Text bold>{key}:</Text> {JSON.stringify(value)}
          </Text>
        ))}
      </Box>
    );
  };

  const renderValidationResult = (result: ManifestValidationResult): React.ReactNode => {
    if (result.valid) {
      return (
        <Box flexDirection="column">
          <Text color="green" bold>Validation Passed</Text>
          {result.manifest && (
            <Text>Plugin: {result.manifest.name}@{result.manifest.version}</Text>
          )}
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text color="red" bold>Validation Failed</Text>
        <Box flexDirection="column" marginTop={1}>
          {result.errors.map((error: ManifestError, index: number) => (
            <Text key={index} color="red">
              - {error.field}: {error.message} ({error.code})
            </Text>
          ))}
        </Box>
      </Box>
    );
  };

  const renderCreatedFiles = (files: readonly string[]): React.ReactNode => {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>Plugin created successfully!</Text>
        <Text />
        <Text>Created files:</Text>
        {files.map((file) => (
          <Text key={file} color="gray">  - {file}</Text>
        ))}
      </Box>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  const renderContent = (): React.ReactNode => {
    // Handle loading/progress states
    if (state.step === 'loading') {
      return (
        <Box flexDirection="column">
          <Spinner label={state.message} />
        </Box>
      );
    }

    if (state.step === 'progress') {
      return (
        <Box flexDirection="column">
          <Spinner label={`${state.phase}${state.progress !== undefined ? ` (${state.progress}%)` : ''}...`} />
        </Box>
      );
    }

    if (state.step === 'error') {
      return (
        <Box flexDirection="column">
          <Text color="red" bold>Error</Text>
          <Text color="red">{state.message}</Text>
        </Box>
      );
    }

    if (state.step === 'success') {
      // Handle specific success states
      switch (state.message) {
        case 'list':
          return (
            <Box flexDirection="column">
              <Text color="cyan" bold>Installed Plugins</Text>
              <Box marginTop={1}>
                {renderPluginTable(state.data as readonly PluginInfo[])}
              </Box>
            </Box>
          );

        case 'search':
          return (
            <Box flexDirection="column">
              <Text color="cyan" bold>Search Results</Text>
              <Box marginTop={1}>
                {renderSearchResults(state.data as readonly RegistryEntry[])}
              </Box>
            </Box>
          );

        case 'info':
          return (
            <Box flexDirection="column">
              <Text color="cyan" bold>Plugin Information</Text>
              <Box marginTop={1}>
                {renderPluginDetail(state.data as PluginDetail | null)}
              </Box>
            </Box>
          );

        case 'config':
          return (
            <Box flexDirection="column">
              <Text color="cyan" bold>Plugin Configuration</Text>
              <Box marginTop={1}>
                {renderConfig(state.data as Record<string, unknown>)}
              </Box>
            </Box>
          );

        case 'validate':
          return (
            <Box flexDirection="column">
              <Text color="cyan" bold>Validation Result</Text>
              <Box marginTop={1}>
                {renderValidationResult(state.data as ManifestValidationResult)}
              </Box>
            </Box>
          );

        default:
          // Generic success message
          if (Array.isArray(state.data)) {
            // Created files list
            return renderCreatedFiles(state.data as readonly string[]);
          }
          return (
            <Box flexDirection="column">
              <Text color="green" bold>Success</Text>
              <Text>{state.message}</Text>
            </Box>
          );
      }
    }

    // Handle commands that don't need async (help, usage messages)
    switch (subcommand) {
      case 'install':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Install</Text>
              <Text color="yellow">Usage: red64 plugin install &lt;name&gt;</Text>
              <Text color="gray">Options:</Text>
              <Text color="gray">  --registry &lt;url&gt;     Custom registry URL</Text>
              <Text color="gray">  --local-path &lt;path&gt;  Install from local path</Text>
              <Text color="gray">  --dev                 Enable dev mode</Text>
            </Box>
          );
        }
        return <Spinner label={`Installing ${pluginArg}...`} />;

      case 'uninstall':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Uninstall</Text>
              <Text color="yellow">Usage: red64 plugin uninstall &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Uninstalling ${pluginArg}...`} />;

      case 'enable':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Enable</Text>
              <Text color="yellow">Usage: red64 plugin enable &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Enabling ${pluginArg}...`} />;

      case 'disable':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Disable</Text>
              <Text color="yellow">Usage: red64 plugin disable &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Disabling ${pluginArg}...`} />;

      case 'update':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Update</Text>
              <Text color="yellow">Usage: red64 plugin update &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Updating ${pluginArg}...`} />;

      case 'search':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Search</Text>
              <Text color="yellow">Usage: red64 plugin search &lt;query&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Searching for "${pluginArg}"...`} />;

      case 'info':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Info</Text>
              <Text color="yellow">Usage: red64 plugin info &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Fetching info for ${pluginArg}...`} />;

      case 'config':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Config</Text>
              <Text color="yellow">Usage: red64 plugin config &lt;name&gt; [key] [value]</Text>
            </Box>
          );
        }
        return <Spinner label={`Loading config for ${pluginArg}...`} />;

      case 'create':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Create</Text>
              <Text color="yellow">Usage: red64 plugin create &lt;name&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Scaffolding ${pluginArg}...`} />;

      case 'validate':
        if (!pluginArg) {
          return (
            <Box flexDirection="column">
              <Text color="cyan">Plugin Validate</Text>
              <Text color="yellow">Usage: red64 plugin validate &lt;path&gt;</Text>
            </Box>
          );
        }
        return <Spinner label={`Validating ${pluginArg}...`} />;

      case 'list':
        return <Spinner label="Loading plugins..." />;

      case 'help':
      default:
        return (
          <Box flexDirection="column">
            <Text color="cyan" bold>red64 plugin - Plugin management commands</Text>
            <Text />
            <Text>Subcommands:</Text>
            <Text>  install &lt;name&gt;      Install a plugin from npm or local path</Text>
            <Text>  uninstall &lt;name&gt;    Remove an installed plugin</Text>
            <Text>  enable &lt;name&gt;       Enable a disabled plugin</Text>
            <Text>  disable &lt;name&gt;      Disable a plugin without removing it</Text>
            <Text>  list                 List all installed plugins</Text>
            <Text>  update &lt;name&gt;       Update a plugin to the latest version</Text>
            <Text>  search &lt;query&gt;      Search for plugins in the registry</Text>
            <Text>  info &lt;name&gt;         Show detailed plugin information</Text>
            <Text>  config &lt;name&gt;       View or set plugin configuration</Text>
            <Text>  create &lt;name&gt;       Scaffold a new plugin project</Text>
            <Text>  validate &lt;path&gt;     Validate a plugin manifest and entry point</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {renderContent()}
    </Box>
  );
};
