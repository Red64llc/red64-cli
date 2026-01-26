/**
 * CLI argument parsing for red64
 * Requirements: 3.2, 3.4, 4.7, 5.1-5.5, 8.1, 8.4, 8.5
 */

import type { CLIConfig, Command, GlobalFlags } from '../types/index.js';

const VALID_COMMANDS: readonly Command[] = [
  'init',
  'start',
  'resume',
  'status',
  'list',
  'abort',
  'help'
] as const;

/**
 * Parse CLI arguments into CLIConfig
 * This function wraps argument parsing logic for testability
 */
export function parseArgs(argv: readonly string[]): CLIConfig {
  const flags: GlobalFlags = {
    skipPermissions: false,
    brownfield: false,
    greenfield: true, // Default to greenfield mode
    tier: undefined,
    help: false,
    version: false
  };

  const positionalArgs: string[] = [];
  let command: Command = undefined;

  // Parse arguments
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--skip-permissions' || arg === '-s') {
      (flags as { skipPermissions: boolean }).skipPermissions = true;
    } else if (arg === '--brownfield' || arg === '-b') {
      (flags as { brownfield: boolean; greenfield: boolean }).brownfield = true;
      (flags as { brownfield: boolean; greenfield: boolean }).greenfield = false;
    } else if (arg === '--greenfield' || arg === '-g') {
      (flags as { greenfield: boolean; brownfield: boolean }).greenfield = true;
      (flags as { greenfield: boolean; brownfield: boolean }).brownfield = false;
    } else if (arg === '--tier' || arg === '-t') {
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        (flags as { tier: string | undefined }).tier = nextArg;
        i++; // Skip the value
      }
    } else if (arg === '--help' || arg === '-h') {
      (flags as { help: boolean }).help = true;
    } else if (arg === '--version' || arg === '-v') {
      (flags as { version: boolean }).version = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  // First positional argument is the command
  if (positionalArgs.length > 0) {
    const potentialCommand = positionalArgs[0] as Command;
    if (VALID_COMMANDS.includes(potentialCommand)) {
      command = potentialCommand;
      positionalArgs.shift(); // Remove command from args
    }
  }

  return {
    command,
    args: positionalArgs,
    flags
  };
}

/**
 * Help text for red64 CLI
 * Requirements: 4.7, 8.1, 8.4, 8.5
 */
export const HELP_TEXT = `
Red64 Flow Orchestrator

Usage:
  red64 init                           Bootstrap project for red64 flows
  red64 start <feature> "<desc>"       Start new feature flow
  red64 resume <feature>               Resume paused/interrupted flow
  red64 status [feature]               Show flow status
  red64 list                           List all active flows
  red64 abort <feature>                Abort and cleanup flow
  red64 help                           Show this help

Global Options:
  -s, --skip-permissions    Pass skip-permissions to Claude CLI
  -b, --brownfield          Enable brownfield mode (gap analysis)
  -g, --greenfield          Greenfield mode (default)
  -t, --tier <name>         Use specified Claude config directory
  -h, --help                Show help
  -v, --version             Show version
`.trim();
