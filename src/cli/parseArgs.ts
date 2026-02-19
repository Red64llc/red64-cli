/**
 * CLI argument parsing for red64
 * Requirements: 3.2, 3.4, 4.7, 5.1-5.5, 8.1, 8.4, 8.5
 */

import type { CLIConfig, Command, GlobalFlags, CodingAgent } from '../types/index.js';
import { isCoreCommand } from '../types/index.js';

const VALID_AGENTS: readonly CodingAgent[] = ['claude', 'gemini', 'codex'] as const;

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
    version: false,
    verbose: false,
    yes: false,
    sandbox: false,
    model: undefined,
    ollama: false,
    // Init-specific flags
    stack: undefined,
    'skip-guided': undefined,
    'no-steering': undefined,
    'skip-tests': undefined,
    'local-image': undefined,
    'task-level': undefined,
    agent: undefined,
    // Plugin-specific flags (Task 10.2)
    registry: undefined,
    'local-path': undefined,
    dev: undefined
  };

  const positionalArgs: string[] = [];
  let command: Command = undefined;

  // Parse arguments
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let argValue: string | undefined;

    // Handle --flag=value syntax
    if (arg.startsWith('--') && arg.includes('=')) {
      const eqIndex = arg.indexOf('=');
      argValue = arg.slice(eqIndex + 1);
      arg = arg.slice(0, eqIndex);
    }

    if (arg === '--skip-permissions' || arg === '-s') {
      (flags as { skipPermissions: boolean }).skipPermissions = true;
    } else if (arg === '--brownfield' || arg === '-b') {
      (flags as { brownfield: boolean; greenfield: boolean }).brownfield = true;
      (flags as { brownfield: boolean; greenfield: boolean }).greenfield = false;
    } else if (arg === '--greenfield' || arg === '-g') {
      (flags as { greenfield: boolean; brownfield: boolean }).greenfield = true;
      (flags as { greenfield: boolean; brownfield: boolean }).brownfield = false;
    } else if (arg === '--tier' || arg === '-t') {
      // Use argValue if --tier=value, otherwise next arg
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-')) {
        (flags as { tier: string | undefined }).tier = value;
        if (!argValue) i++; // Only skip if we used next arg
      }
    } else if (arg === '--help' || arg === '-h') {
      (flags as { help: boolean }).help = true;
    } else if (arg === '--version' || arg === '-v') {
      (flags as { version: boolean }).version = true;
    } else if (arg === '--verbose') {
      (flags as { verbose: boolean }).verbose = true;
    } else if (arg === '--yes' || arg === '-y') {
      (flags as { yes: boolean }).yes = true;
    } else if (arg === '--sandbox') {
      (flags as { sandbox: boolean }).sandbox = true;
    } else if (arg === '--model' || arg === '-m') {
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-')) {
        (flags as { model: string | undefined }).model = value;
        if (!argValue) i++;
      }
    } else if (arg === '--stack') {
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-')) {
        (flags as { stack: string | undefined }).stack = value;
        if (!argValue) i++;
      }
    } else if (arg === '--skip-guided') {
      (flags as { 'skip-guided': boolean })['skip-guided'] = true;
    } else if (arg === '--no-steering') {
      (flags as { 'no-steering': boolean })['no-steering'] = true;
    } else if (arg === '--skip-tests') {
      (flags as { 'skip-tests': boolean })['skip-tests'] = true;
    } else if (arg === '--local-image') {
      (flags as { 'local-image': boolean })['local-image'] = true;
    } else if (arg === '--ollama') {
      (flags as { ollama: boolean }).ollama = true;
    } else if (arg === '--task-level') {
      (flags as { 'task-level': boolean })['task-level'] = true;
    } else if (arg === '--agent' || arg === '-a') {
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-') && VALID_AGENTS.includes(value as CodingAgent)) {
        (flags as { agent: CodingAgent }).agent = value as CodingAgent;
        if (!argValue) i++;
      }
    } else if (arg === '--registry') {
      // Plugin-specific: custom registry URL (Task 10.2, Req 11.3)
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-')) {
        (flags as { registry: string | undefined }).registry = value;
        if (!argValue) i++;
      }
    } else if (arg === '--local-path') {
      // Plugin-specific: local plugin path for install (Task 10.2)
      const value = argValue ?? argv[i + 1];
      if (value && !value.startsWith('-')) {
        (flags as { 'local-path': string | undefined })['local-path'] = value;
        if (!argValue) i++;
      }
    } else if (arg === '--dev') {
      // Plugin-specific: dev mode for hot reload (Task 10.2, Req 12.3)
      (flags as { dev: boolean }).dev = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  // First positional argument is the command
  // Accept both core commands and potential plugin commands (any string)
  if (positionalArgs.length > 0) {
    const potentialCommand = positionalArgs[0];
    // Set command if it's a core command OR looks like a command (not a path/file)
    // Plugin commands will be validated later by CommandRouter
    if (isCoreCommand(potentialCommand) || !potentialCommand.includes('/')) {
      command = potentialCommand as Command;
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
  red64 start <feature> "<desc>"       Start new feature flow (auto-resumes if exists)
  red64 status [feature]               Show flow status
  red64 list                           List all active flows
  red64 abort <feature>                Abort and cleanup flow
  red64 help                           Show this help

Plugin Commands:
  red64 plugin install <name>          Install a plugin
  red64 plugin uninstall <name>        Uninstall a plugin
  red64 plugin enable <name>           Enable a plugin
  red64 plugin disable <name>          Disable a plugin
  red64 plugin list                    List installed plugins
  red64 plugin update <name>           Update a plugin
  red64 plugin search <query>          Search plugin registry
  red64 plugin info <name>             Show plugin details
  red64 plugin config <name> [k] [v]   View/set plugin config
  red64 plugin create <name>           Scaffold a new plugin
  red64 plugin validate <path>         Validate a plugin

Plugin Options:
  --registry <url>            Custom registry URL for plugin operations
  --local-path <path>         Install plugin from local path
  --dev                       Enable dev mode (hot reload)

Init Options:
  -a, --agent <name>        Coding agent: claude, gemini, codex (default: claude)
  --local-image             Build and use local sandbox image instead of GHCR

MCP Commands:
  red64 mcp list                       List configured MCP servers
  red64 mcp add <name> <cmd> [args..]  Add an MCP server
  red64 mcp remove <name>              Remove an MCP server

Global Options:
  -m, --model <name>        Model to use (must match agent, e.g. claude-3-5-haiku-latest)
  -s, --skip-permissions    Pass skip-permissions to Claude CLI
  -b, --brownfield          Enable brownfield mode (gap analysis)
  -g, --greenfield          Greenfield mode (default)
  -t, --tier <name>         Use specified Claude config directory
  --sandbox                 Run Claude in Docker container for isolation
  --ollama                  Use local Ollama backend (localhost:11434)
  --skip-tests              Skip running regression tests
  --task-level              Group sub-tasks by parent task (one commit per group)
  -h, --help                Show help
  -v, --version             Show version
`.trim();
