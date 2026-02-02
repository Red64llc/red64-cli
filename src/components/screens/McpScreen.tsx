/**
 * MCP screen component
 * Handles: red64 mcp list | add | remove
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';
import type { McpServerConfig } from '../../types/index.js';
import { createConfigService, type InitConfig } from '../../services/ConfigService.js';

type McpSubcommand = 'list' | 'add' | 'remove';

type McpScreenState =
  | { step: 'loading' }
  | { step: 'done'; message: string }
  | { step: 'error'; error: string };

function getBaseDir(): string {
  return process.cwd();
}

export const McpScreen: React.FC<ScreenProps> = ({ args }) => {
  const [state, setState] = useState<McpScreenState>({ step: 'loading' });
  const [configService] = useState(() => createConfigService());

  const subcommand = (args[0] ?? 'list') as McpSubcommand;

  useEffect(() => {
    const run = async () => {
      try {
        const baseDir = getBaseDir();
        const config = await configService.load(baseDir);

        if (!config) {
          setState({ step: 'error', error: 'Project not initialized. Run red64 init first.' });
          return;
        }

        switch (subcommand) {
          case 'list': {
            const servers = config.mcpServers ?? {};
            const entries = Object.entries(servers);
            if (entries.length === 0) {
              setState({ step: 'done', message: 'No MCP servers configured.\nAdd one with: red64 mcp add <name> <command> [args...]' });
            } else {
              const lines = entries.map(([name, srv]) =>
                `  ${name}: ${srv.command} ${srv.args.join(' ')}`
              );
              setState({ step: 'done', message: `MCP servers (${entries.length}):\n${lines.join('\n')}` });
            }
            break;
          }

          case 'add': {
            const name = args[1];
            const command = args[2];
            const serverArgs = args.slice(3) as string[];

            if (!name || !command) {
              setState({ step: 'error', error: 'Usage: red64 mcp add <name> <command> [args...]' });
              return;
            }

            const newServer: McpServerConfig = { command, args: serverArgs };
            const updated: InitConfig = {
              ...config,
              mcpServers: {
                ...(config.mcpServers ?? {}),
                [name]: newServer,
              },
            };
            await configService.save(baseDir, updated);
            setState({ step: 'done', message: `Added MCP server "${name}": ${command} ${serverArgs.join(' ')}` });
            break;
          }

          case 'remove': {
            const name = args[1];
            if (!name) {
              setState({ step: 'error', error: 'Usage: red64 mcp remove <name>' });
              return;
            }

            const servers = { ...(config.mcpServers ?? {}) };
            if (!(name in servers)) {
              setState({ step: 'error', error: `MCP server "${name}" not found.` });
              return;
            }
            delete servers[name];
            const updated: InitConfig = { ...config, mcpServers: servers };
            await configService.save(baseDir, updated);
            setState({ step: 'done', message: `Removed MCP server "${name}".` });
            break;
          }

          default:
            setState({ step: 'error', error: `Unknown subcommand: ${subcommand}. Use list, add, or remove.` });
        }
      } catch (error) {
        setState({ step: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    run();
  }, [configService, subcommand, args]);

  switch (state.step) {
    case 'loading':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">mcp</Text>
        </Box>
      );
    case 'done':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">mcp</Text>
          <Box marginTop={1}>
            <Text>{state.message}</Text>
          </Box>
        </Box>
      );
    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">mcp</Text>
          <Box marginTop={1}>
            <Text color="red">Error: {state.error}</Text>
          </Box>
        </Box>
      );
  }
};
