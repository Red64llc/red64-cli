import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { OutputRegion } from '../../../src/components/ui/OutputRegion.js';

describe('OutputRegion', () => {
  it('should render lines', () => {
    const lines = ['Line 1', 'Line 2', 'Line 3'];
    const { lastFrame } = render(
      <OutputRegion lines={lines} />
    );

    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
    expect(lastFrame()).toContain('Line 3');
  });

  it('should render empty state', () => {
    const { lastFrame } = render(
      <OutputRegion lines={[]} />
    );

    // Should render without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should render with optional title', () => {
    const { lastFrame } = render(
      <OutputRegion lines={['Content']} title="Agent Output" />
    );

    expect(lastFrame()).toContain('Agent Output');
    expect(lastFrame()).toContain('Content');
  });

  it('should handle long content', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const { lastFrame } = render(
      <OutputRegion lines={lines} maxHeight={5} />
    );

    // Should render without errors even with maxHeight
    expect(lastFrame()).toBeTruthy();
  });

  it('should work without title', () => {
    const { lastFrame } = render(
      <OutputRegion lines={['Test line']} />
    );

    expect(lastFrame()).toContain('Test line');
  });
});
