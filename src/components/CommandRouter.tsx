/**
 * Command router component
 * Requirements: 4.1-4.7
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
  McpScreen
} from './screens/index.js';

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
    case 'help':
    case undefined:
    default:
      return <HelpScreen {...screenProps} />;
  }
};
