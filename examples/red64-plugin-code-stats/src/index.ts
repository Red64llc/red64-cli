/**
 * code-stats plugin for red64-cli
 *
 * Tracks code statistics during spec-driven development.
 * Demonstrates: commands, hooks, and services extension points.
 */

// Plugin types - external plugins would import from 'red64-cli/plugins'
import type {
  PluginContextInterface,
  PluginModule,
  HookContext,
  HookHandlerResult,
  CommandArgs,
} from './plugin-types.js';
import { createStatsService } from './stats-service.js';
import type { CodeStats, CodeStatsService } from './types.js';

// ---------------------------------------------------------------------------
// Plugin State
// ---------------------------------------------------------------------------

let statsService: CodeStatsService | null = null;

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function formatTable(stats: CodeStats): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Code Statistics');
  lines.push('═'.repeat(50));
  lines.push(`Files:          ${stats.totalFiles}`);
  lines.push(`Total Lines:    ${stats.totalLines}`);
  lines.push(`Code Lines:     ${stats.totalCodeLines}`);
  lines.push(`Comment Lines:  ${stats.totalCommentLines}`);
  lines.push(`Blank Lines:    ${stats.totalBlankLines}`);
  lines.push('');
  lines.push('By Extension:');
  lines.push('─'.repeat(50));

  for (const [ext, extStats] of Object.entries(stats.byExtension)) {
    lines.push(`  ${ext.padEnd(8)} ${String(extStats.files).padStart(5)} files, ${String(extStats.codeLines).padStart(6)} code lines`);
  }

  lines.push('═'.repeat(50));
  lines.push('');

  return lines.join('\n');
}

function formatJson(stats: CodeStats): string {
  return JSON.stringify(stats, null, 2);
}

function formatMarkdown(stats: CodeStats): string {
  const lines: string[] = [];

  lines.push('## Code Statistics\n');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Files | ${stats.totalFiles} |`);
  lines.push(`| Total Lines | ${stats.totalLines} |`);
  lines.push(`| Code Lines | ${stats.totalCodeLines} |`);
  lines.push(`| Comment Lines | ${stats.totalCommentLines} |`);
  lines.push(`| Blank Lines | ${stats.totalBlankLines} |`);
  lines.push('');
  lines.push('### By Extension\n');
  lines.push('| Extension | Files | Code Lines |');
  lines.push('|-----------|-------|------------|');

  for (const [ext, extStats] of Object.entries(stats.byExtension)) {
    lines.push(`| ${ext} | ${extStats.files} | ${extStats.codeLines} |`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export const activate: PluginModule['activate'] = (context: PluginContextInterface) => {
  context.log('info', 'code-stats plugin activating...');

  // Read configuration
  const includeTests = (context.config['includeTests'] as boolean) ?? true;
  const extensions = (context.config['extensions'] as string[]) ?? ['.ts', '.tsx', '.js', '.jsx'];
  const outputFormat = (context.config['outputFormat'] as string) ?? 'table';

  // Create the stats service
  statsService = createStatsService({ includeTests, extensions });

  // ---------------------------------------------------------------------------
  // Register Service
  // ---------------------------------------------------------------------------

  context.registerService({
    name: 'code-stats',
    factory: () => statsService,
    dispose: () => {
      statsService = null;
    },
  });

  // ---------------------------------------------------------------------------
  // Register Commands
  // ---------------------------------------------------------------------------

  // Command: stats
  context.registerCommand({
    name: 'stats',
    description: 'Analyze code statistics for the current project',
    args: [
      { name: 'directory', description: 'Directory to analyze (default: current)', required: false },
    ],
    options: [
      { name: 'format', description: 'Output format: table, json, markdown', type: 'string', alias: 'f' },
      { name: 'include-tests', description: 'Include test files', type: 'boolean', alias: 't' },
    ],
    handler: async (args: CommandArgs) => {
      const directory = args.positional[0] ?? process.cwd();
      const format = (args.options['format'] as string) ?? outputFormat;

      args.context.log('info', `Analyzing ${directory}...`);

      if (!statsService) {
        args.context.log('error', 'Stats service not initialized');
        return;
      }

      try {
        const stats = await statsService.analyze(directory);

        let output: string;
        switch (format) {
          case 'json':
            output = formatJson(stats);
            break;
          case 'markdown':
            output = formatMarkdown(stats);
            break;
          default:
            output = formatTable(stats);
        }

        console.log(output);
      } catch (error) {
        args.context.log('error', `Analysis failed: ${String(error)}`);
      }
    },
  });

  // Command: stats-compare
  context.registerCommand({
    name: 'stats-compare',
    description: 'Compare code statistics between workflow phases',
    args: [
      { name: 'feature', description: 'Feature name to compare', required: true },
    ],
    options: [],
    handler: async (args: CommandArgs) => {
      const feature = args.positional[0];

      if (!statsService) {
        args.context.log('error', 'Stats service not initialized');
        return;
      }

      const snapshots = statsService.getSnapshots(feature);

      if (snapshots.length < 2) {
        args.context.log('info', `Not enough snapshots for feature '${feature}'. Need at least 2 phases.`);
        return;
      }

      console.log(`\nStatistics for feature: ${feature}\n`);
      console.log('Phase Progression:');
      console.log('─'.repeat(60));

      for (let i = 1; i < snapshots.length; i++) {
        const before = snapshots[i - 1];
        const after = snapshots[i];
        const diff = statsService.compareSnapshots(before, after);

        console.log(`\n${before.phase} → ${after.phase}:`);
        console.log(`  Files:      ${diff.filesAdded > 0 ? '+' : ''}${diff.filesAdded - diff.filesRemoved}`);
        console.log(`  Lines:      ${diff.linesAdded > 0 ? '+' : ''}${diff.linesAdded - diff.linesRemoved}`);
        console.log(`  Code Lines: ${diff.codeLinesAdded > 0 ? '+' : ''}${diff.codeLinesAdded - diff.codeLinesRemoved}`);
      }

      console.log('\n' + '─'.repeat(60));
    },
  });

  // ---------------------------------------------------------------------------
  // Register Hooks
  // ---------------------------------------------------------------------------

  // Pre-implementation hook: capture baseline stats
  context.registerHook({
    phase: 'implementation',
    timing: 'pre',
    priority: 'early',
    handler: async (hookContext: HookContext): Promise<HookHandlerResult> => {
      if (!statsService) {
        return { action: 'continue' };
      }

      try {
        context.log('info', `Capturing pre-implementation stats for ${hookContext.feature}`);
        const stats = await statsService.analyze(process.cwd());
        statsService.saveSnapshot(hookContext.feature, 'pre-implementation', stats);
      } catch (error) {
        context.log('warn', `Failed to capture stats: ${String(error)}`);
      }

      return { action: 'continue' };
    },
  });

  // Post-implementation hook: capture final stats and show diff
  context.registerHook({
    phase: 'implementation',
    timing: 'post',
    priority: 'late',
    handler: async (hookContext: HookContext): Promise<HookHandlerResult> => {
      if (!statsService) {
        return { action: 'continue' };
      }

      try {
        context.log('info', `Capturing post-implementation stats for ${hookContext.feature}`);
        const stats = await statsService.analyze(process.cwd());
        statsService.saveSnapshot(hookContext.feature, 'post-implementation', stats);

        // Show summary
        const snapshots = statsService.getSnapshots(hookContext.feature);
        if (snapshots.length >= 2) {
          const before = snapshots[snapshots.length - 2];
          const after = snapshots[snapshots.length - 1];
          const diff = statsService.compareSnapshots(before, after);

          console.log('\n📊 Implementation Statistics:');
          console.log(`   Files changed: +${diff.filesAdded} / -${diff.filesRemoved}`);
          console.log(`   Lines changed: +${diff.linesAdded} / -${diff.linesRemoved}`);
          console.log(`   Code lines:    +${diff.codeLinesAdded} / -${diff.codeLinesRemoved}`);
          console.log('');
        }
      } catch (error) {
        context.log('warn', `Failed to capture stats: ${String(error)}`);
      }

      return { action: 'continue' };
    },
  });

  context.log('info', 'code-stats plugin activated');
};

// ---------------------------------------------------------------------------
// Plugin Cleanup
// ---------------------------------------------------------------------------

export const deactivate: PluginModule['deactivate'] = () => {
  statsService = null;
};
