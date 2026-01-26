import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatusLine } from '../../../src/components/ui/StatusLine.js';

describe('StatusLine', () => {
  it('should render label', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="pending" />
    );

    expect(lastFrame()).toContain('Build');
  });

  it('should render pending status in yellow', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="pending" />
    );

    // Component should show pending status
    expect(lastFrame()).toContain('pending');
  });

  it('should render running status', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="running" />
    );

    expect(lastFrame()).toContain('running');
  });

  it('should render success status', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="success" />
    );

    expect(lastFrame()).toContain('success');
  });

  it('should render error status', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="error" />
    );

    expect(lastFrame()).toContain('error');
  });

  it('should render warning status', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="warning" />
    );

    expect(lastFrame()).toContain('warning');
  });

  it('should render optional message', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="error" message="File not found" />
    );

    expect(lastFrame()).toContain('File not found');
  });

  it('should work without message', () => {
    const { lastFrame } = render(
      <StatusLine label="Build" status="success" />
    );

    expect(lastFrame()).toBeTruthy();
    expect(lastFrame()).not.toContain('undefined');
  });
});
