/**
 * SelectMenu component for interactive selection
 * Requirements: 6.5, 6.6
 */

import React from 'react';
import { Select } from '@inkjs/ui';

/**
 * Menu item interface
 */
export interface SelectMenuItem<T = string> {
  readonly label: string;
  readonly value: T;
}

/**
 * Props for SelectMenu component
 */
interface SelectMenuProps<T = string> {
  readonly items: readonly SelectMenuItem<T>[];
  readonly onSelect: (item: SelectMenuItem<T>) => void;
}

/**
 * Interactive selection menu for approval gates
 * Requirements: 6.5 - Support keyboard navigation
 * Requirements: 6.6 - Render approval gates as interactive selection menus
 */
export function SelectMenu<T = string>({
  items,
  onSelect
}: SelectMenuProps<T>): React.ReactElement {
  const options = items.map(item => ({
    label: item.label,
    value: item.value as string
  }));

  const handleSelect = (value: string) => {
    const selectedItem = items.find(item => item.value === value);
    if (selectedItem) {
      onSelect(selectedItem);
    }
  };

  return (
    <Select
      options={options}
      onChange={handleSelect}
    />
  );
}
