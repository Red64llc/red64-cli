/**
 * Type definitions for code-stats plugin
 */

export interface FileStats {
  path: string;
  lines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
}

export interface CodeStats {
  totalFiles: number;
  totalLines: number;
  totalCodeLines: number;
  totalCommentLines: number;
  totalBlankLines: number;
  byExtension: Record<string, ExtensionStats>;
  files: FileStats[];
}

export interface ExtensionStats {
  files: number;
  lines: number;
  codeLines: number;
}

export interface StatsSnapshot {
  timestamp: string;
  phase: string;
  feature: string;
  stats: CodeStats;
}

export interface CodeStatsService {
  analyze(directory: string): Promise<CodeStats>;
  getSnapshots(feature: string): StatsSnapshot[];
  saveSnapshot(feature: string, phase: string, stats: CodeStats): void;
  compareSnapshots(before: StatsSnapshot, after: StatsSnapshot): StatsDiff;
}

export interface StatsDiff {
  filesAdded: number;
  filesRemoved: number;
  linesAdded: number;
  linesRemoved: number;
  codeLinesAdded: number;
  codeLinesRemoved: number;
}
