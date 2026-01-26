#!/usr/bin/env node
/**
 * CLI entry point for red64
 * Requirements: 3.1, 3.2, 3.4, 4.7, 8.1, 8.4, 8.5
 */

import { render } from 'ink';
import meow from 'meow';
import { App } from './components/App.js';
import { CommandRouter } from './components/CommandRouter.js';
import { parseArgs, HELP_TEXT } from './cli/parseArgs.js';
import { validateFlags } from './cli/validateFlags.js';

/**
 * Main CLI entry point
 * Requirements: 3.2 - Display help menu when invoked without arguments
 */
function main(): void {
  // Use meow for --help and --version handling
  const cli = meow(HELP_TEXT, {
    importMeta: import.meta,
    flags: {
      skipPermissions: {
        type: 'boolean',
        shortFlag: 's',
        default: false
      },
      brownfield: {
        type: 'boolean',
        shortFlag: 'b',
        default: false
      },
      greenfield: {
        type: 'boolean',
        shortFlag: 'g',
        default: true
      },
      tier: {
        type: 'string',
        shortFlag: 't'
      },
      help: {
        type: 'boolean',
        shortFlag: 'h',
        default: false
      },
      version: {
        type: 'boolean',
        shortFlag: 'v',
        default: false
      }
    }
  });

  // Parse arguments using our custom parser for more control
  const config = parseArgs(process.argv.slice(2));

  // Validate flags
  const validation = validateFlags(config.flags);
  if (!validation.valid) {
    console.error(validation.errors.join('\n'));
    process.exit(1);
  }

  // Handle version/help from meow
  if (cli.flags.help || cli.flags.version) {
    // meow already handles these
    return;
  }

  // Render the Ink application
  // Requirements: 3.3 - Use Ink framework for rendering terminal UI components
  render(
    <App config={config}>
      <CommandRouter
        command={config.command}
        args={config.args}
        flags={config.flags}
      />
    </App>
  );
}

// Run main
main();
