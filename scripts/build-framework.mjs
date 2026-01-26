#!/usr/bin/env node
/**
 * Build framework directory from .claude and .kiro sources
 * Transforms kiro → red64 references
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Transform kiro references to red64
 */
function transformContent(content) {
  return content
    // Directory references
    .replace(/\.kiro\//g, '.red64/')
    .replace(/\.kiro(?=[^/a-z]|$)/g, '.red64')
    // Slash command references
    .replace(/\/kiro:/g, '/red64:')
    .replace(/\/kiro-flow:/g, '/red64-flow:')
    // Hyphenated references
    .replace(/kiro-flow/g, 'red64-flow')
    .replace(/kiro-/g, 'red64-')
    // Agent/command directory names
    .replace(/agents\/kiro\//g, 'agents/red64/')
    .replace(/commands\/kiro\//g, 'commands/red64/')
    .replace(/commands\/kiro-flow\//g, 'commands/red64-flow/')
    // Capitalized references
    .replace(/Kiro/g, 'Red64')
    // All caps references
    .replace(/KIRO/g, 'RED64')
    // Standalone lowercase
    .replace(/\bkiro\b/g, 'red64');
}

/**
 * Copy directory recursively with transformation
 */
async function copyDirTransformed(srcDir, destDir, transformFn) {
  await mkdir(destDir, { recursive: true });

  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    // Transform directory names too
    const destName = transformFn ? entry.name.replace(/kiro/g, 'red64') : entry.name;
    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      await copyDirTransformed(srcPath, destPath, transformFn);
    } else if (entry.isFile()) {
      let content = await readFile(srcPath, 'utf-8');
      if (transformFn) {
        content = transformFn(content);
      }
      await writeFile(destPath, content, 'utf-8');
      console.log(`  ${entry.name} -> ${destName}`);
    }
  }
}

async function main() {
  const frameworkDir = join(ROOT, 'framework', '.red64');

  console.log('Building framework from .claude and .kiro sources...\n');

  // 1. Copy and transform commands
  console.log('Copying commands...');
  const claudeCommandsKiro = join(ROOT, '.claude', 'commands', 'kiro');
  const claudeCommandsFlow = join(ROOT, '.claude', 'commands', 'kiro-flow');
  await copyDirTransformed(claudeCommandsKiro, join(frameworkDir, 'commands', 'red64'), transformContent);
  await copyDirTransformed(claudeCommandsFlow, join(frameworkDir, 'commands', 'red64-flow'), transformContent);

  // 2. Copy and transform agents
  console.log('\nCopying agents...');
  const claudeAgents = join(ROOT, '.claude', 'agents', 'kiro');
  await copyDirTransformed(claudeAgents, join(frameworkDir, 'agents', 'red64'), transformContent);

  // 3. Copy and transform settings/rules
  console.log('\nCopying settings/rules...');
  const kiroRules = join(ROOT, '.kiro', 'settings', 'rules');
  await copyDirTransformed(kiroRules, join(frameworkDir, 'settings', 'rules'), transformContent);

  // 4. Copy and transform settings/templates
  console.log('\nCopying settings/templates...');
  const kiroTemplates = join(ROOT, '.kiro', 'settings', 'templates');
  await copyDirTransformed(kiroTemplates, join(frameworkDir, 'settings', 'templates'), transformContent);

  console.log('\nFramework built successfully!');
  console.log(`Output: ${frameworkDir}`);
}

main().catch(console.error);
