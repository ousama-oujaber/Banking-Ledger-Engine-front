/**
 * @ble-frontend/tokens
 *
 * Structural CSS variable definitions, layout breakpoints, and theme helpers.
 * Visual aesthetics and concrete color values remain unopinionated to preserve designer autonomy.
 */

export const BLE_CSS_VARIABLES = {
  // Brand & Surface
  colorPrimary: '--ble-color-primary',
  colorPrimaryHover: '--ble-color-primary-hover',
  colorPrimaryActive: '--ble-color-primary-active',
  colorSurface: '--ble-color-surface',
  colorSurfaceSubtle: '--ble-color-surface-subtle',
  colorSurfaceMuted: '--ble-color-surface-muted',
  colorBackground: '--ble-color-background',
  colorBorder: '--ble-color-border',
  colorBorderSubtle: '--ble-color-border-subtle',

  // Text & Foreground
  colorTextPrimary: '--ble-color-text-primary',
  colorTextSecondary: '--ble-color-text-secondary',
  colorTextMuted: '--ble-color-text-muted',
  colorTextInverse: '--ble-color-text-inverse',

  // Domain Status Semantics
  colorStatusActive: '--ble-color-status-active',
  colorStatusFrozen: '--ble-color-status-frozen',
  colorStatusClosed: '--ble-color-status-closed',
  colorStatusPending: '--ble-color-status-pending',
  colorStatusSuccess: '--ble-color-status-success',
  colorStatusWarning: '--ble-color-status-warning',
  colorStatusDanger: '--ble-color-status-danger',
  colorStatusInfo: '--ble-color-status-info',

  // Spacing Scale
  spacing2xs: '--ble-spacing-2xs',
  spacingXs: '--ble-spacing-xs',
  spacingSm: '--ble-spacing-sm',
  spacingMd: '--ble-spacing-md',
  spacingLg: '--ble-spacing-lg',
  spacingXl: '--ble-spacing-xl',
  spacing2xl: '--ble-spacing-2xl',

  // Typography
  fontFamily: '--ble-font-family',
  fontFamilyMono: '--ble-font-family-mono',
  fontSizeXs: '--ble-font-size-xs',
  fontSizeSm: '--ble-font-size-sm',
  fontSizeBase: '--ble-font-size-base',
  fontSizeLg: '--ble-font-size-lg',
  fontSizeXl: '--ble-font-size-xl',
  fontSize2xl: '--ble-font-size-2xl',
  lineHeightBase: '--ble-line-height-base',
  lineHeightTight: '--ble-line-height-tight',
  fontWeightNormal: '--ble-font-weight-normal',
  fontWeightMedium: '--ble-font-weight-medium',
  fontWeightBold: '--ble-font-weight-bold',

  // Border Radius
  radiusSm: '--ble-radius-sm',
  radiusMd: '--ble-radius-md',
  radiusLg: '--ble-radius-lg',
  radiusFull: '--ble-radius-full',

  // Shadow / Elevations
  shadowSm: '--ble-shadow-sm',
  shadowMd: '--ble-shadow-md',
  shadowLg: '--ble-shadow-lg',

  // Z-Index Layers
  zDropdown: '--ble-z-dropdown',
  zSticky: '--ble-z-sticky',
  zModal: '--ble-z-modal',
  zToast: '--ble-z-toast',
  zTooltip: '--ble-z-tooltip',

  // Transitions
  transitionFast: '--ble-transition-fast',
  transitionNormal: '--ble-transition-normal',
  transitionSlow: '--ble-transition-slow',

  // Breakpoints
  breakpointXs: '--ble-breakpoint-xs',
  breakpointSm: '--ble-breakpoint-sm',
  breakpointMd: '--ble-breakpoint-md',
  breakpointLg: '--ble-breakpoint-lg',
  breakpointXl: '--ble-breakpoint-xl',
} as const;

export type BleCssVariableKey = keyof typeof BLE_CSS_VARIABLES;
export type BleCssVariable = (typeof BLE_CSS_VARIABLES)[BleCssVariableKey];

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Standard responsive breakpoints (in pixels).
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * CSS Media Query string helpers for responsive layouts.
 */
export const MEDIA_QUERIES = {
  up: (bp: Breakpoint): string => `@media (min-width: ${BREAKPOINTS[bp]}px)`,
  down: (bp: Breakpoint): string => `@media (max-width: ${BREAKPOINTS[bp] - 0.02}px)`,
  between: (min: Breakpoint, max: Breakpoint): string =>
    `@media (min-width: ${BREAKPOINTS[min]}px) and (max-width: ${BREAKPOINTS[max] - 0.02}px)`,
} as const;

/**
 * Normalizes a variable key or CSS variable name to `--ble-*`.
 */
export function resolveCssVariableName(key: BleCssVariableKey | string): string {
  if (key.startsWith('--')) {
    return key;
  }
  if (key in BLE_CSS_VARIABLES) {
    return BLE_CSS_VARIABLES[key as BleCssVariableKey];
  }
  return `--${key}`;
}

/**
 * Reads the computed value of a CSS custom property from the DOM.
 */
export function getCssVariable(
  key: BleCssVariableKey | string,
  element?: Element | null,
  fallback = '',
): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const target = element ?? document.documentElement;
  const varName = resolveCssVariableName(key);
  const value = window.getComputedStyle(target).getPropertyValue(varName).trim();
  return value || fallback;
}

/**
 * Sets an inline CSS custom property on a DOM element (defaults to document.documentElement).
 */
export function setCssVariable(
  key: BleCssVariableKey | string,
  value: string,
  element?: HTMLElement | null,
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const target = element ?? document.documentElement;
  const varName = resolveCssVariableName(key);
  target.style.setProperty(varName, value);
}

/**
 * Removes an inline CSS custom property from a DOM element.
 */
export function removeCssVariable(
  key: BleCssVariableKey | string,
  element?: HTMLElement | null,
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const target = element ?? document.documentElement;
  const varName = resolveCssVariableName(key);
  target.style.removeProperty(varName);
}

/**
 * Batch applies a dictionary of theme tokens to an element (defaults to root).
 */
export function applyTheme(
  tokens: Partial<Record<BleCssVariableKey | string, string>>,
  element?: HTMLElement | null,
): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (value !== undefined && value !== null) {
      setCssVariable(key, value, element);
    }
  }
}
