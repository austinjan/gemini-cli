/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { productSettingsCommand } from './productSettingsCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('productSettingsCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext();
  });

  it('should return a dialog action to open the product settings dialog', () => {
    if (!productSettingsCommand.action) {
      throw new Error('The product settings command must have an action.');
    }
    const result = productSettingsCommand.action(mockContext, '');
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'product-settings',
    });
  });

  it('should have the correct name and description', () => {
    expect(productSettingsCommand.name).toBe('product-settings');
    expect(productSettingsCommand.description).toBe(
      'Configure product settings for your project',
    );
  });
});
