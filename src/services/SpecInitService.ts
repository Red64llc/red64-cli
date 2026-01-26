/**
 * Spec Initialization Service
 * Creates the spec directory structure with templates
 * Replaces the /red64:spec-init command for orchestrator use
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
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
 * Find unique feature name by checking existing specs
 */
async function findUniqueName(workDir: string, baseName: string): Promise<string> {
  const specsDir = join(workDir, '.red64', 'specs');

  // If specs directory doesn't exist, base name is unique
  if (!existsSync(specsDir)) {
    return baseName;
  }

  try {
    const existing = await readdir(specsDir);

    // If base name doesn't exist, use it
    if (!existing.includes(baseName)) {
      return baseName;
    }

    // Find next available suffix
    let suffix = 2;
    while (existing.includes(`${baseName}-${suffix}`)) {
      suffix++;
    }

    return `${baseName}-${suffix}`;
  } catch {
    // If we can't read the directory, assume base name is unique
    return baseName;
  }
}

/**
 * Create spec init service
 */
export function createSpecInitService(): SpecInitService {
  return {
    /**
     * Initialize spec directory and files from templates
     *
     * 1. Check uniqueness - append -2, -3 if spec exists
     * 2. Create directory .red64/specs/[feature-name]/
     * 3. Read templates and replace placeholders
     * 4. Write spec.json and requirements.md
     */
    async init(workDir: string, featureName: string, description: string): Promise<SpecInitResult> {
      const sanitizedName = sanitizeFeatureName(featureName);

      try {
        // Step 1: Find unique name
        const uniqueName = await findUniqueName(workDir, sanitizedName);
        const specDir = join(workDir, '.red64', 'specs', uniqueName);

        // Step 2: Create spec directory
        await mkdir(specDir, { recursive: true });

        // Step 3: Read templates (with fallback to defaults)
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

        // Step 4: Replace placeholders
        const specJsonContent = replacePlaceholders(specJsonTemplate, uniqueName, description);
        const requirementsContent = replacePlaceholders(requirementsTemplate, uniqueName, description);

        // Step 5: Write files
        await writeFile(join(specDir, 'spec.json'), specJsonContent, 'utf-8');
        await writeFile(join(specDir, 'requirements.md'), requirementsContent, 'utf-8');

        return {
          success: true,
          specDir,
          featureName: uniqueName
        };
      } catch (error) {
        return {
          success: false,
          specDir: join(workDir, '.red64', 'specs', sanitizedName),
          featureName: sanitizedName,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };
}
