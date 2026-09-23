import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  BLE_CSS_VARIABLES,
  BREAKPOINTS,
  getCssVariable,
  MEDIA_QUERIES,
  removeCssVariable,
  resolveCssVariableName,
  setCssVariable,
} from './index';

describe('tokens library', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  describe('BLE_CSS_VARIABLES', () => {
    it('should map all keys to valid --ble-* CSS custom properties', () => {
      for (const [key, varName] of Object.entries(BLE_CSS_VARIABLES)) {
        expect(varName).toMatch(/^--ble-[a-z0-9-]+$/);
      }
    });

    it('should include required brand, status, and spacing tokens', () => {
      expect(BLE_CSS_VARIABLES.colorPrimary).toBe('--ble-color-primary');
      expect(BLE_CSS_VARIABLES.colorSurface).toBe('--ble-color-surface');
      expect(BLE_CSS_VARIABLES.colorStatusActive).toBe('--ble-color-status-active');
      expect(BLE_CSS_VARIABLES.colorStatusFrozen).toBe('--ble-color-status-frozen');
      expect(BLE_CSS_VARIABLES.colorStatusClosed).toBe('--ble-color-status-closed');
      expect(BLE_CSS_VARIABLES.spacingMd).toBe('--ble-spacing-md');
      expect(BLE_CSS_VARIABLES.fontFamily).toBe('--ble-font-family');
    });
  });

  describe('resolveCssVariableName', () => {
    it('should return token name for known key', () => {
      expect(resolveCssVariableName('colorPrimary')).toBe('--ble-color-primary');
      expect(resolveCssVariableName('spacingSm')).toBe('--ble-spacing-sm');
    });

    it('should preserve strings already prefixed with --', () => {
      expect(resolveCssVariableName('--custom-theme-var')).toBe('--custom-theme-var');
    });

    it('should prefix unrecognized keys with --', () => {
      expect(resolveCssVariableName('customKey')).toBe('--customKey');
    });
  });

  describe('BREAKPOINTS & MEDIA_QUERIES', () => {
    it('should define standard responsive breakpoints', () => {
      expect(BREAKPOINTS.xs).toBe(480);
      expect(BREAKPOINTS.sm).toBe(640);
      expect(BREAKPOINTS.md).toBe(768);
      expect(BREAKPOINTS.lg).toBe(1024);
      expect(BREAKPOINTS.xl).toBe(1280);
      expect(BREAKPOINTS['2xl']).toBe(1536);
    });

    it('should generate valid CSS media query strings', () => {
      expect(MEDIA_QUERIES.up('md')).toBe('@media (min-width: 768px)');
      expect(MEDIA_QUERIES.down('lg')).toBe('@media (max-width: 1023.98px)');
      expect(MEDIA_QUERIES.between('sm', 'lg')).toBe(
        '@media (min-width: 640px) and (max-width: 1023.98px)',
      );
    });
  });

  describe('DOM Theme Helpers', () => {
    it('should set and get CSS custom properties on document root', () => {
      setCssVariable('colorPrimary', '#0052cc');
      expect(getCssVariable('colorPrimary')).toBe('#0052cc');

      setCssVariable('--custom-accent', '#ff5630');
      expect(getCssVariable('--custom-accent')).toBe('#ff5630');
    });

    it('should set and get CSS custom properties on a specific element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      setCssVariable('colorSurface', '#f4f5f7', el);
      expect(getCssVariable('colorSurface', el)).toBe('#f4f5f7');

      el.remove();
    });

    it('should return fallback if variable is not set', () => {
      expect(getCssVariable('colorNonExistent', null, 'default-value')).toBe('default-value');
    });

    it('should remove CSS custom properties', () => {
      setCssVariable('colorPrimary', '#0052cc');
      expect(getCssVariable('colorPrimary')).toBe('#0052cc');

      removeCssVariable('colorPrimary');
      expect(getCssVariable('colorPrimary')).toBe('');
    });

    it('should batch apply theme tokens via applyTheme', () => {
      applyTheme({
        colorPrimary: '#1a73e8',
        colorBackground: '#ffffff',
        spacingMd: '16px',
      });

      expect(getCssVariable('colorPrimary')).toBe('#1a73e8');
      expect(getCssVariable('colorBackground')).toBe('#ffffff');
      expect(getCssVariable('spacingMd')).toBe('16px');
    });
  });
});
