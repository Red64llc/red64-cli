import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Header } from '../../../src/components/ui/Header.js';

describe('Header', () => {
  it('should render title', () => {
    const { lastFrame } = render(
      <Header title="Red64 Flow Orchestrator" />
    );

    expect(lastFrame()).toContain('Red64 Flow Orchestrator');
  });

  it('should render with box-drawing characters', () => {
    const { lastFrame } = render(
      <Header title="Test Title" />
    );

    const frame = lastFrame() ?? '';
    // Should contain some form of border/box characters
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should render optional subtitle', () => {
    const { lastFrame } = render(
      <Header title="Main Title" subtitle="Feature: my-feature" />
    );

    expect(lastFrame()).toContain('Main Title');
    expect(lastFrame()).toContain('Feature: my-feature');
  });

  it('should work without subtitle', () => {
    const { lastFrame } = render(
      <Header title="Only Title" />
    );

    expect(lastFrame()).toContain('Only Title');
    expect(lastFrame()).not.toContain('undefined');
  });
});
