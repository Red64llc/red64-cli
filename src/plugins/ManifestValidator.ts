/**
 * ManifestValidator service
 * Validates plugin manifest files against the canonical Zod schema.
 * Provides both file-based and data-based validation, plus compatibility checking.
 *
 * Requirements: 1.4, 2.1, 2.2, 2.3, 2.5, 2.6, 9.2, 12.4
 */

import { z } from 'zod';
import semver from 'semver';
import { readFile } from 'node:fs/promises';
import type {
  PluginManifest,
  ManifestValidationResult,
  ManifestError,
  CompatibilityResult,
  ManifestValidatorService,
} from './types.js';

// ---------------------------------------------------------------------------
// Zod Schema Definition
// ---------------------------------------------------------------------------

/**
 * Valid extension point values
 */
const extensionPointSchema = z.enum([
  'commands',
  'agents',
  'hooks',
  'services',
  'templates',
]);

/**
 * Plugin dependency schema
 */
const pluginDependencySchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * Configuration field types
 */
const configFieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'array',
  'object',
]);

/**
 * Configuration field schema
 */
const configFieldSchema = z.object({
  type: configFieldTypeSchema,
  description: z.string(),
  default: z.unknown().optional(),
  required: z.boolean().optional(),
});

/**
 * Custom refinement for semver version (exact, not range)
 */
const semverVersionSchema = z.string().refine(
  (val) => semver.valid(val) !== null,
  { message: 'Must be a valid semver version (e.g., 1.0.0)' }
);

/**
 * Custom refinement for semver range
 */
const semverRangeSchema = z.string().refine(
  (val) => semver.validRange(val) !== null,
  { message: 'Must be a valid semver range (e.g., >=0.12.0, ^1.0.0)' }
);

/**
 * Full plugin manifest Zod schema
 */
const pluginManifestSchema = z.object({
  name: z.string(),
  version: semverVersionSchema,
  description: z.string(),
  author: z.string(),
  entryPoint: z.string(),
  red64CliVersion: semverRangeSchema,
  extensionPoints: z.array(extensionPointSchema),
  dependencies: z.array(pluginDependencySchema).optional(),
  configSchema: z.record(z.string(), configFieldSchema).optional(),
});

// ---------------------------------------------------------------------------
// Error Mapping
// ---------------------------------------------------------------------------

/**
 * Map a Zod issue to a ManifestError with the appropriate error code
 */
function mapZodIssueToManifestError(issue: z.ZodIssue): ManifestError {
  // Use the first path segment as the field name for top-level reporting.
  // For nested paths like extensionPoints.1, report as 'extensionPoints'.
  const field = issue.path.length > 0 ? String(issue.path[0]) : 'manifest';

  // Determine error code based on Zod issue type
  let code: ManifestError['code'];

  if (issue.code === 'invalid_type') {
    // Detect missing fields: Zod message contains "received undefined" when a required
    // property is absent from the object. The `received` property may or may not exist
    // on the issue depending on the Zod version.
    const receivedValue =
      'received' in issue
        ? String((issue as Record<string, unknown>)['received'])
        : undefined;

    const isMissing =
      receivedValue === 'undefined' ||
      issue.message.includes('received undefined');

    if (isMissing) {
      code = 'MISSING_FIELD';
    } else {
      code = 'INVALID_TYPE';
    }
  } else if (
    issue.code === 'invalid_enum_value' ||
    issue.code === 'custom'
  ) {
    code = 'INVALID_VALUE';
  } else {
    code = 'SCHEMA_ERROR';
  }

  return {
    field,
    message: issue.message,
    code,
  };
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Create a ManifestValidator service instance
 * Follows the factory function pattern consistent with existing services.
 */
export function createManifestValidator(): ManifestValidatorService {
  /**
   * Validate manifest data (pre-parsed object)
   */
  function validateManifestData(data: unknown): ManifestValidationResult {
    // Guard: input must be a non-null object (not an array)
    if (
      data === null ||
      data === undefined ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      return {
        valid: false,
        manifest: null,
        errors: [
          {
            field: 'manifest',
            message: 'Manifest must be a JSON object',
            code: 'SCHEMA_ERROR',
          },
        ],
      };
    }

    const parseResult = pluginManifestSchema.safeParse(data);

    if (parseResult.success) {
      return {
        valid: true,
        manifest: parseResult.data as PluginManifest,
        errors: [],
      };
    }

    // Map Zod errors to ManifestError format
    const errors: ManifestError[] = parseResult.error.issues.map(
      mapZodIssueToManifestError
    );

    return {
      valid: false,
      manifest: null,
      errors,
    };
  }

  /**
   * Validate a manifest file by reading and parsing JSON from a path
   */
  async function validate(manifestPath: string): Promise<ManifestValidationResult> {
    let fileContent: string;
    try {
      fileContent = await readFile(manifestPath, 'utf-8');
    } catch {
      return {
        valid: false,
        manifest: null,
        errors: [
          {
            field: 'manifest',
            message: `Failed to read manifest file: ${manifestPath}`,
            code: 'SCHEMA_ERROR',
          },
        ],
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(fileContent);
    } catch {
      return {
        valid: false,
        manifest: null,
        errors: [
          {
            field: 'manifest',
            message: `Invalid JSON in manifest file: ${manifestPath}`,
            code: 'SCHEMA_ERROR',
          },
        ],
      };
    }

    return validateManifestData(data);
  }

  /**
   * Check if a manifest's declared red64CliVersion range is compatible
   * with the running CLI version
   */
  function checkCompatibility(
    manifest: PluginManifest,
    cliVersion: string
  ): CompatibilityResult {
    const requiredRange = manifest.red64CliVersion;
    const compatible = semver.satisfies(cliVersion, requiredRange);

    return {
      compatible,
      requiredRange,
      actualVersion: cliVersion,
      message: compatible
        ? `CLI version ${cliVersion} is compatible with required range ${requiredRange}`
        : `CLI version ${cliVersion} does not satisfy required range ${requiredRange}`,
    };
  }

  return {
    validate,
    validateManifestData,
    checkCompatibility,
  };
}
