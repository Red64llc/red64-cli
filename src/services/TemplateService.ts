/**
 * Template service for file extraction and transformation
 * Requirements: 1.3, 2.1-2.7, 3.1-3.6
 */

import { mkdir, readFile, writeFile, readdir, access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CodingAgent } from '../types/index.js';

/**
 * Agent-specific configuration for framework installation
 */
interface AgentConfig {
  readonly configDir: string;       // e.g., '.claude', '.codex', or '' for none
  readonly instructionFile: string; // e.g., 'CLAUDE.md', 'GEMINI.md', 'AGENTS.md'
}

/**
 * Configuration for each supported coding agent
 */
const AGENT_CONFIGS: Record<CodingAgent, AgentConfig> = {
  claude: {
    configDir: '.claude',
    instructionFile: 'CLAUDE.md'
  },
  gemini: {
    configDir: '',  // Gemini doesn't use a hidden config directory
    instructionFile: 'GEMINI.md'
  },
  codex: {
    configDir: '.codex',
    instructionFile: 'AGENTS.md'
  }
};

/**
 * Structure creation result
 */
export interface StructureResult {
  readonly createdDirs: readonly string[];
  readonly createdFiles: readonly string[];
}

/**
 * Stack template application options
 */
export interface StackTemplateOptions {
  readonly sourceDir: string;
  readonly targetDir: string;
  readonly stack: string;
  readonly variables: Record<string, string>;
}

/**
 * Tarball extraction options
 */
export interface ExtractOptions {
  readonly tarballPath: string;
  readonly targetDir: string;
  readonly onProgress?: (file: string) => void;
}

/**
 * Framework installation options
 */
export interface InstallFrameworkOptions {
  readonly sourceDir: string;  // Path to framework directory
  readonly targetDir: string;  // User's project directory
  readonly variables?: Record<string, string>;
  readonly agent?: CodingAgent;  // Selected coding agent (default: 'claude')
}

/**
 * Template service interface
 * Requirements: 1.3, 2.1-2.7, 3.1-3.6
 */
export interface TemplateService {
  /**
   * Extract tarball and transform contents
   * - Extracts to targetDir/.red64/
   * - Renames kiro references to red64
   */
  extract(options: ExtractOptions): Promise<StructureResult>;

  /**
   * Create unified directory structure
   */
  createStructure(targetDir: string): Promise<StructureResult>;

  /**
   * Install the full framework from source to target
   * Copies framework/.red64/ to target/.red64/
   */
  installFramework(options: InstallFrameworkOptions): Promise<StructureResult>;

  /**
   * Apply stack-specific steering templates
   */
  applyStackTemplates(options: StackTemplateOptions): Promise<readonly string[]>;

  /**
   * List available stacks in extracted source
   */
  listStacks(sourceDir: string): Promise<readonly string[]>;
}

/**
 * The unified directory structure to create
 * Requirements: 2.1-2.6
 */
const STRUCTURE_DIRS = [
  '.red64',
  '.red64/steering',
  '.red64/specs',
  '.red64/templates',
  '.red64/settings',
  '.red64/settings/rules',
  '.red64/settings/templates'
];

/**
 * Perform kiro-to-red64 renaming in content
 * Task 3.1: Case-aware string replacement
 */
function transformContent(content: string): string {
  return content
    // Directory references
    .replace(/\.kiro\//g, '.red64/')
    .replace(/\.kiro(?=[^/a-z]|$)/g, '.red64')
    // Slash command references
    .replace(/\/kiro:/g, '/red64:')
    // Hyphenated references (kiro-cli, kiro-spec, etc.)
    .replace(/kiro-/g, 'red64-')
    // Capitalized references
    .replace(/Kiro/g, 'Red64')
    // All caps references
    .replace(/KIRO/g, 'RED64')
    // Standalone lowercase
    .replace(/\bkiro\b/g, 'red64');
}

/**
 * Replace template variables in content
 * Variables are in format {{variableName}}
 */
function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Check if path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Copy framework directory recursively, tracking created dirs and files
 */
async function copyFrameworkDir(
  srcDir: string,
  destDir: string,
  variables: Record<string, string>,
  createdDirs: string[],
  createdFiles: string[],
  relativePath = ''
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  if (relativePath) {
    createdDirs.push(relativePath);
  }

  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await copyFrameworkDir(srcPath, destPath, variables, createdDirs, createdFiles, entryRelPath);
    } else if (entry.isFile()) {
      let content = await readFile(srcPath, 'utf-8');
      content = replaceVariables(content, variables);
      await writeFile(destPath, content, 'utf-8');
      createdFiles.push(entryRelPath);
    }
  }
}

/**
 * Copy directory recursively with transformations
 */
async function copyDirWithTransform(
  srcDir: string,
  destDir: string,
  variables: Record<string, string>
): Promise<string[]> {
  const copiedFiles: string[] = [];

  // Ensure destination exists
  await mkdir(destDir, { recursive: true });

  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      const subFiles = await copyDirWithTransform(srcPath, destPath, variables);
      copiedFiles.push(...subFiles);
    } else if (entry.isFile()) {
      // Read, transform, and write file
      let content = await readFile(srcPath, 'utf-8');
      content = transformContent(content);
      content = replaceVariables(content, variables);
      await writeFile(destPath, content, 'utf-8');
      copiedFiles.push(entry.name);
    }
  }

  return copiedFiles;
}

/**
 * Create template service
 * Task 2.3, 3.1, 3.2: Template service factory
 */
export function createTemplateService(): TemplateService {
  return {
    async extract(_options: ExtractOptions): Promise<StructureResult> {
      // Note: Full tarball extraction will be implemented separately
      // This placeholder allows testing the interface
      const createdDirs: string[] = [];
      const createdFiles: string[] = [];

      return { createdDirs, createdFiles };
    },

    async createStructure(targetDir: string): Promise<StructureResult> {
      const createdDirs: string[] = [];
      const createdFiles: string[] = [];

      // Create all required directories
      for (const dir of STRUCTURE_DIRS) {
        const fullPath = join(targetDir, dir);
        await mkdir(fullPath, { recursive: true });
        createdDirs.push(dir);
      }

      return { createdDirs, createdFiles };
    },

    async installFramework(options: InstallFrameworkOptions): Promise<StructureResult> {
      const { sourceDir, targetDir, variables = {}, agent = 'claude' } = options;
      const createdDirs: string[] = [];
      const createdFiles: string[] = [];

      const agentConfig = AGENT_CONFIGS[agent];
      const agentSourceDir = join(sourceDir, 'agents', agent);

      // 1. Copy agent-specific config directory (e.g., .claude/, .codex/)
      if (agentConfig.configDir) {
        const configSrc = join(agentSourceDir, agentConfig.configDir);
        const configDest = join(targetDir, agentConfig.configDir);
        if (await pathExists(configSrc)) {
          await copyFrameworkDir(configSrc, configDest, variables, createdDirs, createdFiles);
        }
      }

      // 2. Copy shared .red64/ directory (settings, templates)
      const red64Src = join(sourceDir, '.red64');
      const red64Dest = join(targetDir, '.red64');
      if (await pathExists(red64Src)) {
        await copyFrameworkDir(red64Src, red64Dest, variables, createdDirs, createdFiles);
      } else {
        // Fall back to creating empty structure if framework not found
        return this.createStructure(targetDir);
      }

      // 3. Copy agent-specific instruction file (e.g., CLAUDE.md, GEMINI.md, AGENTS.md)
      const instructionSrc = join(agentSourceDir, 'docs', agentConfig.instructionFile);
      const instructionDest = join(targetDir, agentConfig.instructionFile);
      if (await pathExists(instructionSrc)) {
        let content = await readFile(instructionSrc, 'utf-8');
        content = replaceVariables(content, variables);
        await writeFile(instructionDest, content, 'utf-8');
        createdFiles.push(agentConfig.instructionFile);
      }

      // 4. For Gemini: Copy commands.toml if present
      if (agent === 'gemini') {
        const tomlSrc = join(agentSourceDir, 'commands.toml');
        const tomlDest = join(targetDir, 'commands.toml');
        if (await pathExists(tomlSrc)) {
          let content = await readFile(tomlSrc, 'utf-8');
          content = replaceVariables(content, variables);
          await writeFile(tomlDest, content, 'utf-8');
          createdFiles.push('commands.toml');
        }
      }

      // 5. Ensure additional directories exist (specs, steering)
      const additionalDirs = ['.red64/specs', '.red64/steering'];
      for (const dir of additionalDirs) {
        const fullPath = join(targetDir, dir);
        if (!(await pathExists(fullPath))) {
          await mkdir(fullPath, { recursive: true });
          createdDirs.push(dir);
        }
      }

      return { createdDirs, createdFiles };
    },

    async applyStackTemplates(options: StackTemplateOptions): Promise<readonly string[]> {
      const { sourceDir, targetDir, stack, variables } = options;
      const stacksDir = join(sourceDir, 'stacks');

      // Ensure steering directory exists
      const steeringDir = join(targetDir, '.red64', 'steering');
      await mkdir(steeringDir, { recursive: true });

      // Try to find the stack directory
      let stackDir = join(stacksDir, stack);
      let stackExists = await isDirectory(stackDir);

      // Fall back to generic if stack not found
      if (!stackExists) {
        stackDir = join(stacksDir, 'generic');
        stackExists = await isDirectory(stackDir);
      }

      if (!stackExists) {
        return [];
      }

      // Copy and transform files
      const copiedFiles = await copyDirWithTransform(stackDir, steeringDir, variables);

      return copiedFiles;
    },

    async listStacks(sourceDir: string): Promise<readonly string[]> {
      const stacksDir = join(sourceDir, 'stacks');

      if (!(await pathExists(stacksDir))) {
        return [];
      }

      try {
        const entries = await readdir(stacksDir, { withFileTypes: true });
        const stacks = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .sort();

        return stacks;
      } catch {
        return [];
      }
    }
  };
}
