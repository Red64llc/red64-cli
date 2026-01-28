#!/usr/bin/env node
/**
 * Build framework directory from .claude and .kiro sources
 * Transforms kiro → red64 references
 *
 * Creates:
 * - framework/.claude/commands/red64/     (slash commands for Claude Code)
 * - framework/.claude/agents/red64/       (agents for Claude Code)
 * - framework/.red64/settings/            (rules and templates)
 * - framework/CLAUDE.md                   (project instructions template)
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
  const frameworkDir = join(ROOT, 'framework');
  const claudeDir = join(frameworkDir, '.claude');
  const red64Dir = join(frameworkDir, '.red64');

  console.log('Building framework from .claude and .kiro sources...\n');

  // 1. Copy and transform commands to .claude/commands/
  console.log('Copying commands to .claude/commands/...');
  const claudeCommandsKiro = join(ROOT, '.claude', 'commands', 'kiro');
  const claudeCommandsFlow = join(ROOT, '.claude', 'commands', 'kiro-flow');
  await copyDirTransformed(claudeCommandsKiro, join(claudeDir, 'commands', 'red64'), transformContent);
  await copyDirTransformed(claudeCommandsFlow, join(claudeDir, 'commands', 'red64-flow'), transformContent);

  // 2. Copy and transform agents to .claude/agents/
  console.log('\nCopying agents to .claude/agents/...');
  const claudeAgents = join(ROOT, '.claude', 'agents', 'kiro');
  await copyDirTransformed(claudeAgents, join(claudeDir, 'agents', 'red64'), transformContent);

  // 3. Copy and transform settings/rules to .red64/settings/
  console.log('\nCopying settings/rules to .red64/settings/...');
  const kiroRules = join(ROOT, '.kiro', 'settings', 'rules');
  await copyDirTransformed(kiroRules, join(red64Dir, 'settings', 'rules'), transformContent);

  // 4. Copy and transform settings/templates to .red64/settings/
  console.log('\nCopying settings/templates to .red64/settings/...');
  const kiroTemplates = join(ROOT, '.kiro', 'settings', 'templates');
  await copyDirTransformed(kiroTemplates, join(red64Dir, 'settings', 'templates'), transformContent);

  // 5. Create CLAUDE.md template
  console.log('\nCreating CLAUDE.md template...');
  const claudeMdContent = `# Red64 Spec-Driven Development

This project uses Red64 for AI-assisted spec-driven development.

## Project Context

### Paths
- Steering: \`.red64/steering/\`
- Specs: \`.red64/specs/\`

### Steering vs Specification

**Steering** (\`.red64/steering/\`) - Guide AI with project-wide rules and context
**Specs** (\`.red64/specs/\`) - Formalize development process for individual features

### Active Specifications
- Check \`.red64/specs/\` for active specifications
- Use \`/red64:spec-status [feature-name]\` to check progress

## Development Guidelines
- Think in English, generate responses in English. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): \`/red64:steering\`, \`/red64:steering-custom\`
- Phase 1 (Specification):
  - \`/red64:spec-init "description"\`
  - \`/red64:spec-requirements {feature}\`
  - \`/red64:validate-gap {feature}\` (optional: for existing codebase)
  - \`/red64:spec-design {feature} [-y]\`
  - \`/red64:validate-design {feature}\` (optional: design review)
  - \`/red64:spec-tasks {feature} [-y]\`
- Phase 2 (Implementation): \`/red64:spec-impl {feature} [tasks]\`
  - \`/red64:validate-impl {feature}\` (optional: after implementation)
- Progress check: \`/red64:spec-status {feature}\` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use \`-y\` only for intentional fast-track
- Keep steering current and verify alignment with \`/red64:spec-status\`
- Follow the user's instructions precisely, and within that scope act autonomously

## Steering Configuration
- Load entire \`.red64/steering/\` as project memory
- Default files: \`product.md\`, \`tech.md\`, \`structure.md\`
- Custom files are supported (managed via \`/red64:steering-custom\`)
`;
  await writeFile(join(frameworkDir, 'CLAUDE.md'), claudeMdContent, 'utf-8');
  console.log('  CLAUDE.md created');

  console.log('\nFramework built successfully!');
  console.log(`Output: ${frameworkDir}`);
  console.log('\nStructure:');
  console.log('  framework/');
  console.log('  ├── .claude/                    (root Claude Code config)');
  console.log('  ├── .red64/settings/            (rules & templates)');
  console.log('  ├── agents/                     (multi-agent support)');
  console.log('  │   ├── claude/                 (Claude Code)');
  console.log('  │   │   ├── .claude/commands/red64/');
  console.log('  │   │   ├── .claude/agents/red64/');
  console.log('  │   │   └── docs/CLAUDE.md');
  console.log('  │   ├── codex/                  (OpenAI Codex)');
  console.log('  │   │   ├── .codex/commands/red64/');
  console.log('  │   │   ├── .codex/agents/red64/');
  console.log('  │   │   └── docs/AGENTS.md');
  console.log('  │   └── gemini/                 (Google Gemini)');
  console.log('  │       ├── commands.toml');
  console.log('  │       └── docs/GEMINI.md');
  console.log('  ├── stacks/                     (steering templates)');
  console.log('  └── CLAUDE.md                   (project instructions)');
}

main().catch(console.error);
