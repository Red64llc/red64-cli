/**
 * Code statistics analysis service
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  CodeStats,
  FileStats,
  StatsSnapshot,
  StatsDiff,
  CodeStatsService,
} from './types.js';

export interface StatsServiceConfig {
  includeTests: boolean;
  extensions: string[];
}

/**
 * Create a CodeStatsService instance
 */
export function createStatsService(config: StatsServiceConfig): CodeStatsService {
  const snapshots = new Map<string, StatsSnapshot[]>();

  async function analyze(directory: string): Promise<CodeStats> {
    const files: FileStats[] = [];
    const byExtension: Record<string, { files: number; lines: number; codeLines: number }> = {};

    await walkDirectory(directory, async (filePath) => {
      const ext = path.extname(filePath);

      // Skip if extension not in config
      if (!config.extensions.includes(ext)) {
        return;
      }

      // Skip test files if configured
      if (!config.includeTests && isTestFile(filePath)) {
        return;
      }

      // Skip node_modules and hidden directories
      if (filePath.includes('node_modules') || filePath.includes('/.')) {
        return;
      }

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileStats = analyzeFile(filePath, content);
        files.push(fileStats);

        // Aggregate by extension
        if (!byExtension[ext]) {
          byExtension[ext] = { files: 0, lines: 0, codeLines: 0 };
        }
        byExtension[ext].files++;
        byExtension[ext].lines += fileStats.lines;
        byExtension[ext].codeLines += fileStats.codeLines;
      } catch {
        // Skip files that can't be read
      }
    });

    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
    const totalCodeLines = files.reduce((sum, f) => sum + f.codeLines, 0);
    const totalCommentLines = files.reduce((sum, f) => sum + f.commentLines, 0);
    const totalBlankLines = files.reduce((sum, f) => sum + f.blankLines, 0);

    return {
      totalFiles: files.length,
      totalLines,
      totalCodeLines,
      totalCommentLines,
      totalBlankLines,
      byExtension,
      files,
    };
  }

  function analyzeFile(filePath: string, content: string): FileStats {
    const lines = content.split('\n');
    let blankLines = 0;
    let commentLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        blankLines++;
        continue;
      }

      // Handle block comments
      if (inBlockComment) {
        commentLines++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed.startsWith('/*')) {
        commentLines++;
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }

      // Single-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        commentLines++;
        continue;
      }
    }

    return {
      path: filePath,
      lines: lines.length,
      blankLines,
      commentLines,
      codeLines: lines.length - blankLines - commentLines,
    };
  }

  async function walkDirectory(
    dir: string,
    callback: (filePath: string) => Promise<void>
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          await walkDirectory(fullPath, callback);
        } else if (entry.isFile()) {
          await callback(fullPath);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  function isTestFile(filePath: string): boolean {
    const name = path.basename(filePath);
    return (
      name.includes('.test.') ||
      name.includes('.spec.') ||
      name.includes('_test.') ||
      filePath.includes('/__tests__/') ||
      filePath.includes('/tests/')
    );
  }

  function getSnapshots(feature: string): StatsSnapshot[] {
    return snapshots.get(feature) ?? [];
  }

  function saveSnapshot(feature: string, phase: string, stats: CodeStats): void {
    const snapshot: StatsSnapshot = {
      timestamp: new Date().toISOString(),
      phase,
      feature,
      stats,
    };

    const existing = snapshots.get(feature) ?? [];
    existing.push(snapshot);
    snapshots.set(feature, existing);
  }

  function compareSnapshots(before: StatsSnapshot, after: StatsSnapshot): StatsDiff {
    return {
      filesAdded: Math.max(0, after.stats.totalFiles - before.stats.totalFiles),
      filesRemoved: Math.max(0, before.stats.totalFiles - after.stats.totalFiles),
      linesAdded: Math.max(0, after.stats.totalLines - before.stats.totalLines),
      linesRemoved: Math.max(0, before.stats.totalLines - after.stats.totalLines),
      codeLinesAdded: Math.max(0, after.stats.totalCodeLines - before.stats.totalCodeLines),
      codeLinesRemoved: Math.max(0, before.stats.totalCodeLines - after.stats.totalCodeLines),
    };
  }

  return {
    analyze,
    getSnapshots,
    saveSnapshot,
    compareSnapshots,
  };
}
