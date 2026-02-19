/**
 * PluginCommandScreen - Executes plugin-provided commands
 *
 * This screen handles commands that are not core CLI commands but are
 * registered by plugins. It initializes the plugin system, looks up
 * the command in the registry, and executes it.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { GlobalFlags } from '../../types/index.js';
import { createPluginBootstrap } from '../../plugins/PluginBootstrap.js';
import { createPluginContext } from '../../plugins/PluginContext.js';
import type { CommandArgs } from '../../plugins/types.js';

interface PluginCommandScreenProps {
  readonly command: string;
  readonly args: readonly string[];
  readonly flags: GlobalFlags;
}

type ScreenState =
  | { status: 'loading' }
  | { status: 'not_found'; command: string }
  | { status: 'executing' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export const PluginCommandScreen: React.FC<PluginCommandScreenProps> = ({
  command,
  args,
  flags,
}) => {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function executePluginCommand() {
      try {
        // Initialize the plugin system
        const projectDir = process.cwd();
        const nodeModulesDir = `${projectDir}/node_modules`;

        // Get CLI version from package.json
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        // Navigate from dist/components/screens/ to package.json
        const packageJson = require('../../../package.json');
        const cliVersion = packageJson.version ?? '0.12.0';

        const bootstrap = await createPluginBootstrap({
          projectDir,
          nodeModulesDir,
          cliVersion,
          pluginsEnabled: true,
        });

        if (cancelled) return;

        // Look up the command in the plugin registry
        const pluginCommand = bootstrap.commandExtension.getCommand(command);

        if (!pluginCommand) {
          setState({ status: 'not_found', command });
          return;
        }

        setState({ status: 'executing' });

        // Parse options from flags
        const options: Record<string, string | boolean | number> = {};
        for (const [key, value] of Object.entries(flags)) {
          if (value !== undefined && value !== null) {
            options[key] = value;
          }
        }

        // Create command args
        const commandArgs: CommandArgs = {
          positional: args,
          options,
          context: createPluginContext({
            pluginName: pluginCommand.pluginName,
            pluginVersion: '1.0.0', // Will be resolved from registry
            config: {},
            cliVersion,
            projectConfig: null,
            registry: bootstrap.registry,
          }),
        };

        // Execute the command
        const result = await bootstrap.commandExtension.executeCommand(
          command,
          commandArgs
        );

        if (cancelled) return;

        if (result.success) {
          setState({ status: 'success' });
          // Exit after successful command execution
          setTimeout(() => process.exit(0), 100);
        } else {
          setState({ status: 'error', message: result.error ?? 'Unknown error' });
          setTimeout(() => process.exit(1), 100);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
        setTimeout(() => process.exit(1), 100);
      }
    }

    executePluginCommand();

    return () => {
      cancelled = true;
    };
  }, [command, args, flags]);

  switch (state.status) {
    case 'loading':
      return (
        <Box>
          <Text dimColor>Loading plugins...</Text>
        </Box>
      );

    case 'not_found':
      return (
        <Box flexDirection="column">
          <Text color="red">Unknown command: {state.command}</Text>
          <Text dimColor>
            Run &apos;red64 help&apos; for available commands.
          </Text>
        </Box>
      );

    case 'executing':
      return (
        <Box>
          <Text dimColor>Executing {command}...</Text>
        </Box>
      );

    case 'success':
      // Command output is handled by the command handler itself
      return null;

    case 'error':
      return (
        <Box flexDirection="column">
          <Text color="red">Error: {state.message}</Text>
        </Box>
      );
  }
};
