/**
 * Help screen component
 * Requirements: 4.7, 8.5
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenProps } from './ScreenProps.js';
import type { Command } from '../../types/index.js';

/**
 * Extended props for HelpScreen
 */
interface HelpScreenProps extends ScreenProps {
  readonly helpCommand?: Command;
}

/**
 * Command-specific help content
 */
const COMMAND_HELP: Record<string, { usage: string; description: string; options: string[] }> = {
  init: {
    usage: 'red64 init [options]',
    description: 'Initialize Red64 in your project. Creates .red64/ directory with configuration and steering documents.',
    options: [
      '-a, --agent <name>     Coding agent: claude, gemini, codex (default: claude)',
      '--stack <name>         Tech stack template (react, node, python, etc.)',
      '--skip-guided          Skip interactive setup wizard',
      '--no-steering          Skip steering document generation',
      '-h, --help             Show this help'
    ]
  },
  start: {
    usage: 'red64 start <feature> "<description>" [options]',
    description: 'Start a new feature development flow, or resume an existing one. Creates git worktree, generates specs, and implements tasks.',
    options: [
      '-m, --model <name>     Model to use (e.g., claude-3-5-haiku-latest for dev)',
      '-y, --yes              Auto-approve all phases (skip review gates)',
      '-b, --brownfield       Enable gap analysis for existing codebases',
      '-g, --greenfield       New feature mode (default)',
      '-s, --skip-permissions Pass --dangerously-skip-permissions to Claude CLI',
      '-t, --tier <name>      Use specific Claude config directory',
      '--sandbox              Run in Docker isolation',
      '--ollama               Use local Ollama backend (localhost:11434)',
      '--verbose              Show detailed execution logs',
      '-h, --help             Show this help'
    ]
  },
  status: {
    usage: 'red64 status [feature]',
    description: 'Show the status of a flow. If no feature is specified, shows status of all flows.',
    options: [
      '-h, --help             Show this help'
    ]
  },
  list: {
    usage: 'red64 list',
    description: 'List all active flows in the repository.',
    options: [
      '-h, --help             Show this help'
    ]
  },
  abort: {
    usage: 'red64 abort <feature>',
    description: 'Abort a flow and clean up resources (worktree, branch, state).',
    options: [
      '-h, --help             Show this help'
    ]
  }
};

/**
 * Display comprehensive usage information for all commands
 * Requirements: 4.7, 8.5 - Display detailed usage information with red64 branding
 */
export const HelpScreen: React.FC<HelpScreenProps> = ({ helpCommand }) => {
  // Show command-specific help if requested
  if (helpCommand && COMMAND_HELP[helpCommand]) {
    const help = COMMAND_HELP[helpCommand];
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">red64 {helpCommand}</Text>
        <Text></Text>
        <Text bold>Usage:</Text>
        <Text>  {help.usage}</Text>
        <Text></Text>
        <Text bold>Description:</Text>
        <Text>  {help.description}</Text>
        <Text></Text>
        <Text bold>Options:</Text>
        {help.options.map((opt, i) => (
          <Text key={i}>  {opt}</Text>
        ))}
      </Box>
    );
  }

  // Show general help
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Red64 Flow Orchestrator
      </Text>
      <Text></Text>
      <Text bold>Usage:</Text>
      <Text>  red64 init                           Bootstrap project for red64 flows</Text>
      <Text>  red64 start {'<feature>'} {"\"<desc>\""}       Start or resume feature flow</Text>
      <Text>  red64 status [feature]               Show flow status</Text>
      <Text>  red64 list                           List all active flows</Text>
      <Text>  red64 abort {'<feature>'}                Abort and cleanup flow</Text>
      <Text>  red64 help                           Show this help</Text>
      <Text></Text>
      <Text bold>Global Options:</Text>
      <Text>  -m, --model {'<name>'}        Model to use (e.g., claude-3-5-haiku-latest)</Text>
      <Text>  -s, --skip-permissions    Pass skip-permissions to Claude CLI</Text>
      <Text>  -b, --brownfield          Enable brownfield mode (gap analysis)</Text>
      <Text>  -g, --greenfield          Greenfield mode (default)</Text>
      <Text>  -t, --tier {'<name>'}         Use specified Claude config directory</Text>
      <Text>  --sandbox                 Run in Docker container for isolation</Text>
      <Text>  --ollama                  Use local Ollama backend (localhost:11434)</Text>
      <Text>  -h, --help                Show help (use with command for details)</Text>
      <Text>  -v, --version             Show version</Text>
      <Text></Text>
      <Text dimColor>Run 'red64 {'<command>'} --help' for more information on a command.</Text>
    </Box>
  );
};
