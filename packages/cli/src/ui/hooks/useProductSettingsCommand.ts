/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export function useProductSettingsCommand() {
  const [isProductSettingsDialogOpen, setIsProductSettingsDialogOpen] =
    useState(false);

  const openProductSettingsDialog = useCallback(() => {
    setIsProductSettingsDialogOpen(true);
  }, []);

  const closeProductSettingsDialog = useCallback(() => {
    setIsProductSettingsDialogOpen(false);
  }, []);

  return {
    isProductSettingsDialogOpen,
    openProductSettingsDialog,
    closeProductSettingsDialog,
  };
}
