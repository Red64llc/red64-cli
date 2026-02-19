/**
 * Comprehensive ManifestValidator tests - Task 11.1
 * Additional tests for edge cases and comprehensive coverage.
 *
 * Requirements coverage: 1.4, 2.1, 2.2, 2.3, 2.5, 2.6
 */
import { describe, it, expect } from 'vitest';
import { createManifestValidator } from '../../../src/plugins/ManifestValidator.js';
import type { PluginManifest } from '../../../src/plugins/types.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createValidManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: './index.js',
    red64CliVersion: '>=1.0.0',
    extensionPoints: ['commands'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ManifestValidator - Comprehensive Coverage', () => {
  const validator = createManifestValidator();

  describe('valid manifest acceptance', () => {
    it('accepts a fully valid manifest with all required fields', () => {
      const manifest = createValidManifest();
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest).not.toBeNull();
      expect(result.errors).toEqual([]);
    });

    it('accepts manifest with optional dependencies field', () => {
      const manifest = createValidManifest({
        dependencies: [
          { name: 'other-plugin', version: '>=1.0.0' },
          { name: 'another-plugin', version: '^2.0.0' },
        ],
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest?.dependencies).toHaveLength(2);
    });

    it('accepts manifest with optional configSchema field', () => {
      const manifest = createValidManifest({
        configSchema: {
          apiKey: { type: 'string', description: 'API key', required: true },
          timeout: { type: 'number', description: 'Timeout', default: 30 },
          debug: { type: 'boolean', description: 'Debug mode', default: false },
        },
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest?.configSchema).toBeDefined();
      expect(Object.keys(result.manifest?.configSchema ?? {})).toHaveLength(3);
    });

    it('accepts all valid extension point types', () => {
      const manifest = createValidManifest({
        extensionPoints: ['commands', 'agents', 'hooks', 'services', 'templates'],
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest?.extensionPoints).toHaveLength(5);
    });
  });

  describe('missing required fields produce specific error codes', () => {
    it('produces MISSING_FIELD error for missing name', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).name;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'name')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing version', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).version;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'version')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing description', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).description;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'description')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing author', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).author;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'author')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing entryPoint', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).entryPoint;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'entryPoint')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing red64CliVersion', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).red64CliVersion;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'red64CliVersion')).toBe(true);
    });

    it('produces MISSING_FIELD error for missing extensionPoints', () => {
      const manifest = { ...createValidManifest() };
      delete (manifest as Record<string, unknown>).extensionPoints;

      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD' && e.field === 'extensionPoints')).toBe(true);
    });
  });

  describe('invalid semver ranges are rejected', () => {
    it('rejects invalid semver version format (not-a-version)', () => {
      const manifest = createValidManifest({ version: 'not-a-version' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'version')).toBe(true);
    });

    it('rejects version with missing patch (1.0)', () => {
      const manifest = createValidManifest({ version: '1.0' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'version')).toBe(true);
    });

    it('rejects version range instead of exact version (^1.0.0)', () => {
      const manifest = createValidManifest({ version: '^1.0.0' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'version')).toBe(true);
    });

    it('rejects invalid red64CliVersion range', () => {
      const manifest = createValidManifest({ red64CliVersion: 'not-a-range' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'red64CliVersion')).toBe(true);
    });

    it('accepts valid complex semver ranges', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=1.0.0 <2.0.0 || ^3.0.0' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });
  });

  describe('config schema validation', () => {
    it('accepts all valid config field types', () => {
      const manifest = createValidManifest({
        configSchema: {
          strField: { type: 'string', description: 'String field' },
          numField: { type: 'number', description: 'Number field' },
          boolField: { type: 'boolean', description: 'Boolean field' },
          arrField: { type: 'array', description: 'Array field' },
          objField: { type: 'object', description: 'Object field' },
        },
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });

    it('rejects invalid config field type', () => {
      const manifest = createValidManifest({
        configSchema: {
          badField: { type: 'invalid-type' as 'string', description: 'Bad field' },
        },
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'configSchema')).toBe(true);
    });

    it('accepts config field with default value', () => {
      const manifest = createValidManifest({
        configSchema: {
          withDefault: { type: 'string', description: 'With default', default: 'hello' },
        },
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });

    it('accepts config field with required flag', () => {
      const manifest = createValidManifest({
        configSchema: {
          requiredField: { type: 'string', description: 'Required', required: true },
        },
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });
  });

  describe('compatibility checking handles edge cases', () => {
    it('handles exact version match', () => {
      const manifest = createValidManifest({ red64CliVersion: '1.0.0' });
      const result = validator.checkCompatibility(manifest, '1.0.0');

      expect(result.compatible).toBe(true);
    });

    it('handles pre-release CLI versions', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=1.0.0-alpha.1' });
      const result = validator.checkCompatibility(manifest, '1.0.0-alpha.1');

      expect(result.compatible).toBe(true);
    });

    it('handles pre-release version in range check', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=1.0.0' });
      // Pre-release versions do not satisfy normal ranges by default in semver
      const result = validator.checkCompatibility(manifest, '1.0.0-beta.1');

      // This is expected behavior - pre-release does not satisfy >=1.0.0
      expect(result.compatible).toBe(false);
    });

    it('handles complex version ranges', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=1.0.0 <2.0.0' });

      expect(validator.checkCompatibility(manifest, '1.5.0').compatible).toBe(true);
      expect(validator.checkCompatibility(manifest, '0.9.0').compatible).toBe(false);
      expect(validator.checkCompatibility(manifest, '2.0.0').compatible).toBe(false);
    });

    it('handles caret range (^1.0.0)', () => {
      const manifest = createValidManifest({ red64CliVersion: '^1.0.0' });

      expect(validator.checkCompatibility(manifest, '1.0.0').compatible).toBe(true);
      expect(validator.checkCompatibility(manifest, '1.9.9').compatible).toBe(true);
      expect(validator.checkCompatibility(manifest, '2.0.0').compatible).toBe(false);
    });

    it('handles tilde range (~1.0.0)', () => {
      const manifest = createValidManifest({ red64CliVersion: '~1.0.0' });

      expect(validator.checkCompatibility(manifest, '1.0.0').compatible).toBe(true);
      expect(validator.checkCompatibility(manifest, '1.0.9').compatible).toBe(true);
      expect(validator.checkCompatibility(manifest, '1.1.0').compatible).toBe(false);
    });

    it('provides descriptive message for compatible versions', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=1.0.0' });
      const result = validator.checkCompatibility(manifest, '1.5.0');

      expect(result.message).toContain('1.5.0');
      expect(result.message).toContain('>=1.0.0');
      expect(result.message).toContain('compatible');
    });

    it('provides descriptive message for incompatible versions', () => {
      const manifest = createValidManifest({ red64CliVersion: '>=2.0.0' });
      const result = validator.checkCompatibility(manifest, '1.0.0');

      expect(result.message).toContain('1.0.0');
      expect(result.message).toContain('>=2.0.0');
      expect(result.message).toMatch(/not.*satisfy|does not/i);
    });
  });

  describe('invalid extension points are rejected', () => {
    it('rejects unknown extension point', () => {
      const manifest = createValidManifest({
        extensionPoints: ['commands', 'unknown-point' as 'commands'],
      });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'extensionPoints')).toBe(true);
    });

    it('accepts empty extension points array', () => {
      const manifest = createValidManifest({ extensionPoints: [] });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('rejects null input', () => {
      const result = validator.validateManifestData(null);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
    });

    it('rejects undefined input', () => {
      const result = validator.validateManifestData(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
    });

    it('rejects array input', () => {
      const result = validator.validateManifestData([]);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
    });

    it('rejects primitive input', () => {
      const result = validator.validateManifestData('string');

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
    });

    it('accepts pre-release version in manifest version field', () => {
      const manifest = createValidManifest({ version: '1.0.0-alpha.1' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });

    it('accepts version with build metadata', () => {
      const manifest = createValidManifest({ version: '1.0.0+build.123' });
      const result = validator.validateManifestData(manifest);

      expect(result.valid).toBe(true);
    });
  });
});
