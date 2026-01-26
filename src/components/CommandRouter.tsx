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
  ResumeScreen,
  StatusScreen,
  ListScreen,
  AbortScreen
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

  switch (command) {
    case 'init':
      return <InitScreen {...screenProps} />;
    case 'start':
      return <StartScreen {...screenProps} />;
    case 'resume':
      return <ResumeScreen {...screenProps} />;
    case 'status':
      return <StatusScreen {...screenProps} />;
    case 'list':
      return <ListScreen {...screenProps} />;
    case 'abort':
      return <AbortScreen {...screenProps} />;
    case 'help':
    case undefined:
    default:
      return <HelpScreen {...screenProps} />;
  }
};
