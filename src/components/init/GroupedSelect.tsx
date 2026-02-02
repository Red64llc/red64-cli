/**
 * GroupedSelect component
 * A select component that renders options organized under category headers.
 * Group headers are non-selectable; keyboard navigation skips them.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import figures from 'figures';

export interface GroupedOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface OptionGroup {
  readonly label: string;
  readonly options: readonly GroupedOption[];
}

export interface GroupedSelectProps {
  readonly groups: readonly OptionGroup[];
  readonly visibleOptionCount?: number;
  readonly onChange: (value: string) => void;
}

interface FlatItem {
  readonly type: 'header' | 'option';
  readonly label: string;
  readonly value?: string;
  readonly hint?: string;
}

function flattenGroups(groups: readonly OptionGroup[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const group of groups) {
    items.push({ type: 'header', label: group.label });
    for (const opt of group.options) {
      items.push({ type: 'option', label: opt.label, value: opt.value, hint: opt.hint });
    }
  }
  return items;
}

function getSelectableIndices(items: readonly FlatItem[]): number[] {
  return items.reduce<number[]>((acc, item, i) => {
    if (item.type === 'option') acc.push(i);
    return acc;
  }, []);
}

export const GroupedSelect: React.FC<GroupedSelectProps> = ({
  groups,
  visibleOptionCount = 15,
  onChange,
}) => {
  const flatItems = flattenGroups(groups);
  const selectableIndices = getSelectableIndices(flatItems);

  const [focusedSelectableIdx, setFocusedSelectableIdx] = useState(0);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const confirmedRef = useRef(false);

  const focusedFlatIdx = selectableIndices[focusedSelectableIdx] ?? 0;

  // Compute visible window
  const halfWindow = Math.floor(visibleOptionCount / 2);
  let windowStart = Math.max(0, focusedFlatIdx - halfWindow);
  const windowEnd = Math.min(flatItems.length, windowStart + visibleOptionCount);
  if (windowEnd === flatItems.length) {
    windowStart = Math.max(0, windowEnd - visibleOptionCount);
  }
  const visibleItems = flatItems.slice(windowStart, windowEnd);

  const handleSelect = useCallback(() => {
    if (confirmedRef.current) return;
    const item = flatItems[focusedFlatIdx];
    if (item?.type === 'option' && item.value !== undefined) {
      confirmedRef.current = true;
      setSelectedValue(item.value);
      setTimeout(() => {
        onChange(item.value!);
      }, 300);
    }
  }, [flatItems, focusedFlatIdx, onChange]);

  useInput((_input, key) => {
    if (confirmedRef.current) return;
    if (key.upArrow) {
      setFocusedSelectableIdx(prev =>
        prev > 0 ? prev - 1 : selectableIndices.length - 1
      );
    } else if (key.downArrow) {
      setFocusedSelectableIdx(prev =>
        prev < selectableIndices.length - 1 ? prev + 1 : 0
      );
    } else if (key.return) {
      handleSelect();
    }
  });

  const showTopIndicator = windowStart > 0;
  const showBottomIndicator = windowEnd < flatItems.length;

  return (
    <Box flexDirection="column">
      {showTopIndicator && (
        <Text dimColor>  ↑ more</Text>
      )}
      {visibleItems.map((item, i) => {
        const flatIdx = windowStart + i;
        const isFocused = flatIdx === focusedFlatIdx;

        if (item.type === 'header') {
          return (
            <Box key={`header-${item.label}`} marginTop={i > 0 ? 1 : 0}>
              <Text dimColor>  ── {item.label} ──</Text>
            </Box>
          );
        }

        const isSelected = item.value === selectedValue;
        const pointer = isSelected ? figures.tick : isFocused ? figures.pointer : ' ';
        const color = isSelected ? 'green' : isFocused ? 'cyan' : undefined;
        return (
          <Box key={item.value}>
            <Text color={color} bold={isFocused || isSelected}>
              {pointer} {item.label}
            </Text>
            {item.hint && (
              <Text dimColor>  ({item.hint})</Text>
            )}
          </Box>
        );
      })}
      {showBottomIndicator && (
        <Text dimColor>  ↓ more</Text>
      )}
    </Box>
  );
};
