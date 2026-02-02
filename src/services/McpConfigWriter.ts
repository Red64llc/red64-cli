/**
 * MCP Config Writer service
 * Injects MCP server configurations into agent-native config files before invocation.
 * Supports Claude (.mcp.json), Gemini (.gemini/settings.json), and Codex (~/.codex/config.toml).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CodingAgent, McpServerConfig } from '../types/index.js';

const RED64_PREFIX = 'red64-';

export interface McpConfigWriterService {
  /**
   * Inject MCP servers into the agent's native config.
   * Returns list of files modified (for cleanup).
   */
  inject(agent: CodingAgent, workDir: string, mcpServers: Record<string, McpServerConfig>): Promise<string[]>;

  /**
   * Remove red64-injected MCP servers from agent configs.
   */
  cleanup(agent: CodingAgent, workDir: string): Promise<void>;
}

/**
 * Read JSON file safely, returning fallback on failure.
 */
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

/**
 * Prefix server names with red64- for safe identification.
 */
function prefixServers(mcpServers: Record<string, McpServerConfig>): Record<string, McpServerConfig> {
  const result: Record<string, McpServerConfig> = {};
  for (const [name, config] of Object.entries(mcpServers)) {
    const key = name.startsWith(RED64_PREFIX) ? name : `${RED64_PREFIX}${name}`;
    result[key] = config;
  }
  return result;
}

/**
 * Remove red64-prefixed keys from a servers object.
 */
function removeRed64Servers(servers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(servers)) {
    if (!key.startsWith(RED64_PREFIX)) {
      result[key] = value;
    }
  }
  return result;
}

// --- Claude adapter ---

async function injectClaude(workDir: string, servers: Record<string, McpServerConfig>): Promise<string> {
  const configPath = join(workDir, '.mcp.json');
  const existing = await readJson<{ mcpServers?: Record<string, unknown> }>(configPath, {});
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...prefixServers(servers),
    },
  };
  await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  return configPath;
}

async function cleanupClaude(workDir: string): Promise<void> {
  const configPath = join(workDir, '.mcp.json');
  const existing = await readJson<{ mcpServers?: Record<string, unknown> }>(configPath, { mcpServers: {} });
  if (!existing.mcpServers) return;
  existing.mcpServers = removeRed64Servers(existing.mcpServers);
  // If no servers remain and no other keys, remove the file content gracefully
  await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

// --- Gemini adapter ---

async function injectGemini(workDir: string, servers: Record<string, McpServerConfig>): Promise<string> {
  const dirPath = join(workDir, '.gemini');
  await mkdir(dirPath, { recursive: true });
  const configPath = join(dirPath, 'settings.json');
  const existing = await readJson<{ mcpServers?: Record<string, unknown> }>(configPath, {});
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...prefixServers(servers),
    },
  };
  await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  return configPath;
}

async function cleanupGemini(workDir: string): Promise<void> {
  const dirPath = join(workDir, '.gemini');
  const configPath = join(dirPath, 'settings.json');
  const existing = await readJson<{ mcpServers?: Record<string, unknown> }>(configPath, { mcpServers: {} });
  if (!existing.mcpServers) return;
  existing.mcpServers = removeRed64Servers(existing.mcpServers);
  await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

// --- Codex adapter ---

/**
 * Minimal TOML writer for Codex MCP config.
 * Codex uses [mcp_servers.<name>] sections with command and args keys.
 */
function buildCodexToml(servers: Record<string, McpServerConfig>): string {
  const lines: string[] = [];
  for (const [name, config] of Object.entries(servers)) {
    lines.push(`[mcp_servers.${name}]`);
    lines.push(`command = "${config.command}"`);
    lines.push(`args = [${config.args.map(a => `"${a}"`).join(', ')}]`);
    if (config.env && Object.keys(config.env).length > 0) {
      lines.push('[mcp_servers.' + name + '.env]');
      for (const [k, v] of Object.entries(config.env)) {
        lines.push(`${k} = "${v}"`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function injectCodex(_workDir: string, servers: Record<string, McpServerConfig>): Promise<string> {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const codexDir = join(homeDir, '.codex');
  await mkdir(codexDir, { recursive: true });
  const configPath = join(codexDir, 'config.toml');

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf-8');
  } catch { /* file doesn't exist */ }

  // Remove existing red64- sections
  const cleaned = existing.replace(/\[mcp_servers\.red64-[^\]]*\][\s\S]*?(?=\[|$)/g, '');

  const prefixed = prefixServers(servers);
  const newSections = buildCodexToml(prefixed);

  await writeFile(configPath, cleaned.trimEnd() + '\n\n' + newSections, 'utf-8');
  return configPath;
}

async function cleanupCodex(): Promise<void> {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const configPath = join(homeDir, '.codex', 'config.toml');

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf-8');
  } catch { return; }

  const cleaned = existing.replace(/\[mcp_servers\.red64-[^\]]*\][\s\S]*?(?=\[|$)/g, '');
  await writeFile(configPath, cleaned.trimEnd() + '\n', 'utf-8');
}

/**
 * Create MCP config writer service.
 */
export function createMcpConfigWriter(): McpConfigWriterService {
  return {
    async inject(agent, workDir, mcpServers) {
      if (!mcpServers || Object.keys(mcpServers).length === 0) return [];

      switch (agent) {
        case 'claude': return [await injectClaude(workDir, mcpServers)];
        case 'gemini': return [await injectGemini(workDir, mcpServers)];
        case 'codex': return [await injectCodex(workDir, mcpServers)];
        default: return [];
      }
    },

    async cleanup(agent, workDir) {
      switch (agent) {
        case 'claude': return cleanupClaude(workDir);
        case 'gemini': return cleanupGemini(workDir);
        case 'codex': return cleanupCodex();
      }
    },
  };
}
