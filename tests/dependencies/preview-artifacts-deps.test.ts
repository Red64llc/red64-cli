import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Preview Artifacts Dependencies', () => {
  it('should have marked v14.1.3+ installed', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    expect(packageJson.dependencies.marked).toBeDefined();

    // Extract version number (remove ^ or ~ prefix)
    const version = packageJson.dependencies.marked.replace(/^[\^~]/, '');
    const [major, minor, patch] = version.split('.').map(Number);

    expect(major).toBeGreaterThanOrEqual(14);
    if (major === 14) {
      expect(minor).toBeGreaterThanOrEqual(1);
      if (minor === 1) {
        expect(patch).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('should have github-markdown-css v5.7.0+ installed', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    expect(packageJson.dependencies['github-markdown-css']).toBeDefined();

    // Extract version number (remove ^ or ~ prefix)
    const version = packageJson.dependencies['github-markdown-css'].replace(/^[\^~]/, '');
    const [major, minor, patch] = version.split('.').map(Number);

    expect(major).toBeGreaterThanOrEqual(5);
    if (major === 5) {
      expect(minor).toBeGreaterThanOrEqual(7);
      if (minor === 7) {
        expect(patch).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have open v11.0.0+ installed', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    expect(packageJson.dependencies.open).toBeDefined();

    // Extract version number (remove ^ or ~ prefix)
    const version = packageJson.dependencies.open.replace(/^[\^~]/, '');
    const [major, minor, patch] = version.split('.').map(Number);

    expect(major).toBeGreaterThanOrEqual(11);
    if (major === 11) {
      expect(minor).toBeGreaterThanOrEqual(0);
      if (minor === 0) {
        expect(patch).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have all dependencies installed in node_modules', () => {
    const fs = require('fs');
    const path = require('path');

    // Verify packages are actually installed, not just declared
    expect(() => require('marked')).not.toThrow();
    expect(() => require('open')).not.toThrow();

    // Verify github-markdown-css CSS file exists
    const cssPath = path.join(process.cwd(), 'node_modules', 'github-markdown-css', 'github-markdown.css');
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  it('should verify marked can parse markdown', () => {
    const { marked } = require('marked');

    const markdown = '# Test Heading\n\nThis is a paragraph.';
    const html = marked.parse(markdown);

    expect(html).toContain('<h1>Test Heading</h1>');
    expect(html).toContain('<p>This is a paragraph.</p>');
  });

  it('should verify open package exports', () => {
    const openModule = require('open');

    // Verify default export is a function
    expect(typeof openModule.default).toBe('function');
  });
});
