/**
 * Spec Initialization Service
 * Creates the spec directory structure with templates
 * Replaces the /red64:spec-init command for orchestrator use
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { sanitizeFeatureName } from './WorktreeService.js';

/**
 * Spec initialization result
 */
export interface SpecInitResult {
  readonly success: boolean;
  readonly specDir: string;
  readonly featureName: string;
  readonly error?: string;
}

/**
 * Spec initialization service interface
 */
export interface SpecInitService {
  init(workDir: string, featureName: string, description: string): Promise<SpecInitResult>;
}

/**
 * Default spec.json template content
 */
const DEFAULT_SPEC_JSON_TEMPLATE = `{
  "feature_name": "{{FEATURE_NAME}}",
  "created_at": "{{TIMESTAMP}}",
  "updated_at": "{{TIMESTAMP}}",
  "language": "en",
  "phase": "initialized",
  "approvals": {
    "requirements": {
      "generated": false,
      "approved": false
    },
    "design": {
      "generated": false,
      "approved": false
    },
    "tasks": {
      "generated": false,
      "approved": false
    }
  },
  "ready_for_implementation": false
}
`;

/**
 * Default requirements.md template content
 */
const DEFAULT_REQUIREMENTS_TEMPLATE = `# Requirements Document

## Project Description (Input)
{{PROJECT_DESCRIPTION}}

## Requirements
<!-- Will be generated in /red64:spec-requirements phase -->

`;

/**
 * Replace template placeholders
 */
function replacePlaceholders(
  template: string,
  featureName: string,
  description: string
): string {
  const timestamp = new Date().toISOString();

  return template
    .replace(/\{\{FEATURE_NAME\}\}/g, featureName)
    .replace(/\{\{TIMESTAMP\}\}/g, timestamp)
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, description);
}

/**
 * Read template file or return default
 */
async function readTemplateOrDefault(
  workDir: string,
  templatePath: string,
  defaultContent: string
): Promise<string> {
  const fullPath = join(workDir, templatePath);

  if (existsSync(fullPath)) {
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      return defaultContent;
    }
  }

  return defaultContent;
}

/**
 * Check if spec already exists
 * Returns true if spec directory exists with spec.json
 */
async function specExists(workDir: string, featureName: string): Promise<boolean> {
  const specJsonPath = join(workDir, '.red64', 'specs', featureName, 'spec.json');
  return existsSync(specJsonPath);
}

/**
 * Create spec init service
 */
export function createSpecInitService(): SpecInitService {
  return {
    /**
     * Initialize spec directory and files from templates
     *
     * Uses the sanitized feature name consistently (same as worktree/branch naming).
     * If spec already exists, returns success without overwriting (supports resume).
     *
     * 1. Sanitize feature name (consistent with worktree naming)
     * 2. Check if spec already exists (skip if so)
     * 3. Create directory .red64/specs/[feature-name]/
     * 4. Read templates and replace placeholders
     * 5. Write spec.json and requirements.md
     */
    async init(workDir: string, featureName: string, description: string): Promise<SpecInitResult> {
      const sanitizedName = sanitizeFeatureName(featureName);
      const specDir = join(workDir, '.red64', 'specs', sanitizedName);

      try {
        // Check if spec already exists (resume scenario)
        if (await specExists(workDir, sanitizedName)) {
          return {
            success: true,
            specDir,
            featureName: sanitizedName
          };
        }

        // Create spec directory
        await mkdir(specDir, { recursive: true });

        // Read templates (with fallback to defaults)
        const specJsonTemplate = await readTemplateOrDefault(
          workDir,
          '.red64/settings/templates/specs/init.json',
          DEFAULT_SPEC_JSON_TEMPLATE
        );

        const requirementsTemplate = await readTemplateOrDefault(
          workDir,
          '.red64/settings/templates/specs/requirements-init.md',
          DEFAULT_REQUIREMENTS_TEMPLATE
        );

        // Replace placeholders
        const specJsonContent = replacePlaceholders(specJsonTemplate, sanitizedName, description);
        const requirementsContent = replacePlaceholders(requirementsTemplate, sanitizedName, description);

        // Write files
        await writeFile(join(specDir, 'spec.json'), specJsonContent, 'utf-8');
        await writeFile(join(specDir, 'requirements.md'), requirementsContent, 'utf-8');

        return {
          success: true,
          specDir,
          featureName: sanitizedName
        };
      } catch (error) {
        return {
          success: false,
          specDir,
          featureName: sanitizedName,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };
}
