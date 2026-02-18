/**
 * Command router component
 * Requirements: 4.1-4.7
 * Task 9.1: Integrated plugin commands
 */

import React from 'react';
import type { Command, GlobalFlags } from '../types/index.js';
import {
  HelpScreen,
  InitScreen,
  StartScreen,
  StatusScreen,
  ListScreen,
  AbortScreen,
  McpScreen,
  PluginScreen,
  PluginCommandScreen,
} from './screens/index.js';
import { isCoreCommand } from '../types/index.js';

/**
 * Props for CommandRouter
 */
interface CommandRouterProps {
  readonly command: Command;
  readonly args: readonly string[];
  readonly flags: GlobalFlags;
}

/**
 * Route commands to appropriate screen components
 * Requirements: 4.1-4.7 - Map command string to screen component
 */
export const CommandRouter: React.FC<CommandRouterProps> = ({
  command,
  args,
  flags
}) => {
  const screenProps = { args, flags };

  // If help flag is set, show help for the specific command
  if (flags.help && command && command !== 'help') {
    return <HelpScreen {...screenProps} helpCommand={command} />;
  }

  // Handle core commands
  switch (command) {
    case 'init':
      return <InitScreen {...screenProps} />;
    case 'start':
      return <StartScreen {...screenProps} />;
    case 'status':
      return <StatusScreen {...screenProps} />;
    case 'list':
      return <ListScreen {...screenProps} />;
    case 'abort':
      return <AbortScreen {...screenProps} />;
    case 'mcp':
      return <McpScreen {...screenProps} />;
    case 'plugin':
      // Task 9.1: Route to PluginScreen for plugin command group
      return <PluginScreen {...screenProps} />;
    case 'help':
    case undefined:
      return <HelpScreen {...screenProps} />;
    default:
      // Unknown command - try plugin commands
      if (command && !isCoreCommand(command)) {
        return (
          <PluginCommandScreen
            command={command}
            args={args}
            flags={flags}
          />
        );
      }
      return <HelpScreen {...screenProps} />;
  }
};
