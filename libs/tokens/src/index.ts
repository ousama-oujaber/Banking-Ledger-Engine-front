/**
 * @ble-frontend/tokens
 *
 * Structural CSS variable definitions and semantic token hooks.
 * Visual aesthetics and theme definitions are managed via variables.css.
 */

export const BLE_CSS_VARIABLES = {
  colorPrimary: '--ble-color-primary',
  colorPrimaryHover: '--ble-color-primary-hover',
  colorSurface: '--ble-color-surface',
  colorBackground: '--ble-color-background',
  colorTextPrimary: '--ble-color-text-primary',
  colorTextSecondary: '--ble-color-text-secondary',
  colorStatusActive: '--ble-color-status-active',
  colorStatusFrozen: '--ble-color-status-frozen',
  colorStatusClosed: '--ble-color-status-closed',
  spacingXs: '--ble-spacing-xs',
  spacingSm: '--ble-spacing-sm',
  spacingMd: '--ble-spacing-md',
  spacingLg: '--ble-spacing-lg',
  spacingXl: '--ble-spacing-xl',
  fontFamily: '--ble-font-family',
  fontSizeBase: '--ble-font-size-base',
  fontSizeSm: '--ble-font-size-sm',
  fontSizeLg: '--ble-font-size-lg',
  fontSizeXl: '--ble-font-size-xl',
} as const;

export type BleCssVariableKey = keyof typeof BLE_CSS_VARIABLES;
