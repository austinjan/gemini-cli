/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import chalk from 'chalk';
import { cpSlice, cpLen, stripUnsafeCharacters } from '../utils/textUtils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ProductSettings {
  name: string;
  styleReferenceUrl: string;
  platform: 'Windows' | 'Linux';
  modules: string[];
}

interface ProductSettingsDialogProps {
  onSelect: (settings: ProductSettings | undefined) => void;
  availableTerminalHeight?: number;
  workingDirectory: string;
}

const DEFAULT_SETTINGS: ProductSettings = {
  name: 'new-project',
  styleReferenceUrl: '',
  platform: 'Windows',
  modules: [],
};

type FocusMode = 'settings' | 'actions';
type EditingField = 'name' | null;

export function ProductSettingsDialog({
  onSelect,
  availableTerminalHeight,
  workingDirectory,
}: ProductSettingsDialogProps): React.JSX.Element {
  const [settings, setSettings] = useState<ProductSettings>(DEFAULT_SETTINGS);
  const [focusMode, setFocusMode] = useState<FocusMode>('settings');
  const [actionIndex, setActionIndex] = useState(0);

  // Editing state
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  const [editCursorPos, setEditCursorPos] = useState<number>(0);
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);

  // Load settings from file on mount
  useEffect(() => {
    const settingsPath = path.join(
      workingDirectory,
      '.aaagent',
      'product-settings.json',
    );
    try {
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        const loaded = JSON.parse(content);
        setSettings({ ...DEFAULT_SETTINGS, ...loaded });
      }
    } catch (error) {
      console.error('Failed to load product settings:', error);
    }
  }, [workingDirectory]);

  // Cursor blinking effect
  useEffect(() => {
    if (!editingField) {
      setCursorVisible(true);
      return;
    }
    const id = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, [editingField]);

  const startEditing = (field: EditingField, initial: string) => {
    setEditingField(field);
    setEditBuffer(initial);
    setEditCursorPos(cpLen(initial));
  };

  const commitEdit = () => {
    if (!editingField) return;

    const trimmed = editBuffer.trim();
    if (trimmed === '') {
      setEditingField(null);
      setEditBuffer('');
      setEditCursorPos(0);
      return;
    }

    if (editingField === 'name') {
      setSettings((prev) => ({ ...prev, name: trimmed }));
    }

    setEditingField(null);
    setEditBuffer('');
    setEditCursorPos(0);
  };

  const saveSettings = () => {
    const aaagentDir = path.join(workingDirectory, '.aaagent');
    const settingsPath = path.join(aaagentDir, 'product-settings.json');

    try {
      if (!fs.existsSync(aaagentDir)) {
        fs.mkdirSync(aaagentDir, { recursive: true });
      }

      fs.writeFileSync(
        settingsPath,
        JSON.stringify(settings, null, 2),
        'utf-8',
      );
      onSelect(settings);
    } catch (error) {
      console.error('Failed to save product settings:', error);
      onSelect(undefined);
    }
  };

  // Handle keyboard for editing
  useKeypress(
    (key) => {
      const { name } = key;

      // Handle editing mode
      if (editingField) {
        if (key.paste && key.sequence) {
          const pasted = stripUnsafeCharacters(key.sequence);
          if (pasted) {
            setEditBuffer((b) => {
              const before = cpSlice(b, 0, editCursorPos);
              const after = cpSlice(b, editCursorPos);
              return before + pasted + after;
            });
            setEditCursorPos((pos) => pos + cpLen(pasted));
          }
          return;
        }
        if (name === 'backspace' && editCursorPos > 0) {
          setEditBuffer((b) => {
            const before = cpSlice(b, 0, editCursorPos - 1);
            const after = cpSlice(b, editCursorPos);
            return before + after;
          });
          setEditCursorPos((pos) => pos - 1);
          return;
        }
        if (name === 'delete' && editCursorPos < cpLen(editBuffer)) {
          setEditBuffer((b) => {
            const before = cpSlice(b, 0, editCursorPos);
            const after = cpSlice(b, editCursorPos + 1);
            return before + after;
          });
          return;
        }
        if (name === 'escape') {
          setEditingField(null);
          setEditBuffer('');
          setEditCursorPos(0);
          return;
        }
        if (name === 'return') {
          commitEdit();
          return;
        }
        if (name === 'left') {
          setEditCursorPos((pos) => Math.max(0, pos - 1));
          return;
        }
        if (name === 'right') {
          setEditCursorPos((pos) => Math.min(cpLen(editBuffer), pos + 1));
          return;
        }
        if (name === 'home') {
          setEditCursorPos(0);
          return;
        }
        if (name === 'end') {
          setEditCursorPos(cpLen(editBuffer));
          return;
        }

        const ch = stripUnsafeCharacters(key.sequence || '');
        if (ch.length === 1) {
          setEditBuffer((b) => {
            const before = cpSlice(b, 0, editCursorPos);
            const after = cpSlice(b, editCursorPos);
            return before + ch + after;
          });
          setEditCursorPos((pos) => pos + 1);
        }
        return;
      }

      // Handle Tab to switch focus
      if (name === 'tab') {
        setFocusMode((prev) => (prev === 'settings' ? 'actions' : 'settings'));
        return;
      }

      if (name === 'escape') {
        onSelect(undefined);
        return;
      }

      // Handle actions section
      if (focusMode === 'actions') {
        if (name === 'left' || name === 'h') {
          setActionIndex(0);
        } else if (name === 'right' || name === 'l') {
          setActionIndex(1);
        } else if (name === 'return') {
          if (actionIndex === 0) {
            saveSettings();
          } else {
            onSelect(undefined);
          }
        }
      }
    },
    { isActive: true },
  );

  const handleSettingSelect = (value: string) => {
    if (editingField) return; // Don't handle selection while editing

    if (value === 'name') {
      startEditing('name', settings.name);
    } else if (value === 'platform-windows') {
      setSettings((prev) => ({ ...prev, platform: 'Windows' }));
    } else if (value === 'platform-linux') {
      setSettings((prev) => ({ ...prev, platform: 'Linux' }));
    } else if (value === 'module-sqlite') {
      setSettings((prev) => ({
        ...prev,
        modules: prev.modules.includes('sqlite')
          ? prev.modules.filter((m) => m !== 'sqlite')
          : [...prev.modules, 'sqlite'],
      }));
    } else if (value === 'module-i18n') {
      setSettings((prev) => ({
        ...prev,
        modules: prev.modules.includes('i18n')
          ? prev.modules.filter((m) => m !== 'i18n')
          : [...prev.modules, 'i18n'],
      }));
    }
  };

  const renderFieldValue = useCallback(
    (value: string, isEditing: boolean) => {
      if (isEditing) {
        if (cursorVisible && editCursorPos < cpLen(editBuffer)) {
          const before = cpSlice(editBuffer, 0, editCursorPos);
          const at = cpSlice(editBuffer, editCursorPos, editCursorPos + 1);
          const after = cpSlice(editBuffer, editCursorPos + 1);
          return before + chalk.inverse(at) + after;
        } else if (cursorVisible && editCursorPos >= cpLen(editBuffer)) {
          return editBuffer + chalk.inverse(' ');
        } else {
          return editBuffer;
        }
      }
      return value;
    },
    [cursorVisible, editCursorPos, editBuffer],
  );

  // Build settings items - use useMemo to prevent recreation on every render
  const settingItems = useMemo(
    () => [
      {
        label:
          editingField === 'name'
            ? `Product Name: ${renderFieldValue(settings.name, true)}`
            : `Product Name: ${settings.name}`,
        value: 'name',
        key: 'name',
      },
      {
        label: `Platform: Windows ${settings.platform === 'Windows' ? '●' : '○'}`,
        value: 'platform-windows',
        key: 'platform-windows',
      },
      {
        label: `Platform: Linux ${settings.platform === 'Linux' ? '●' : '○'}`,
        value: 'platform-linux',
        key: 'platform-linux',
      },
      {
        label: `${settings.modules.includes('sqlite') ? '☑' : '☐'} Module: SQLite`,
        value: 'module-sqlite',
        key: 'module-sqlite',
      },
      {
        label: `${settings.modules.includes('i18n') ? '☑' : '☐'} Module: i18n (English & Chinese)`,
        value: 'module-i18n',
        key: 'module-i18n',
      },
    ],
    [settings, editingField, renderFieldValue],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.text.primary}>
        Product Settings
      </Text>
      <Box height={1} />

      <Text bold={focusMode === 'settings'}>
        {focusMode === 'settings' ? '> ' : '  '}Settings
      </Text>
      <RadioButtonSelect
        items={settingItems}
        initialIndex={0}
        onSelect={handleSettingSelect}
        isFocused={focusMode === 'settings' && !editingField}
        maxItemsToShow={
          availableTerminalHeight
            ? Math.floor(availableTerminalHeight * 0.6)
            : 12
        }
        showScrollArrows={true}
      />

      <Box marginTop={1}>
        <Text bold={focusMode === 'actions'}>
          {focusMode === 'actions' ? '> ' : '  '}Actions
        </Text>
      </Box>
      <Box flexDirection="row" gap={4} paddingLeft={2}>
        <Text
          bold={focusMode === 'actions' && actionIndex === 0}
          color={
            focusMode === 'actions' && actionIndex === 0
              ? theme.status.success
              : theme.text.primary
          }
        >
          {focusMode === 'actions' && actionIndex === 0 ? '> ' : '  '}[Apply]
        </Text>
        <Text
          bold={focusMode === 'actions' && actionIndex === 1}
          color={
            focusMode === 'actions' && actionIndex === 1
              ? theme.status.error
              : theme.text.primary
          }
        >
          {focusMode === 'actions' && actionIndex === 1 ? '> ' : '  '}[Cancel]
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {editingField
            ? '(Enter to confirm, Esc to cancel editing)'
            : focusMode === 'actions'
              ? '(←→ to select, Enter to confirm, Tab to switch, Esc to cancel)'
              : '(Enter to edit/toggle, ↑↓ to navigate, Tab to switch, Esc to cancel)'}
        </Text>
      </Box>
    </Box>
  );
}
