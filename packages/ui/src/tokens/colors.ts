/**
 * YellowShifts Semantic Design Tokens: Colors
 *
 * Mirrors packages/ui/src/styles/tokens.css (the CSS variables are the source of truth).
 * - Brand Surface: #FCBC00
 * - Brand Accent: #FFDB07
 * - Brand Subtle: #FFF7CC
 * - Brand Crimson / Action: #D10040
 * - Base Surface: #F6F6F6
 * - Raised Surface: #FFFFFF
 */

export const colors = {
  // Brand Surfaces & Accents
  brand: {
    yellow: '#FCBC00',
    yellowAccent: '#FFD23F',
    yellowSubtle: '#FFF4CC',
    crimson: '#D10040',
    crimsonHover: '#B30037',
    crimsonActive: '#8F002B',
  },

  // Application Surfaces
  surface: {
    base: '#F3F2EE',
    raised: '#FFFFFF',
    muted: '#ECEBE6',
    overlay: 'rgba(28, 23, 20, 0.52)',
  },

  // Typography & Content
  text: {
    primary: '#1C1714',
    secondary: '#554D47',
    muted: '#6E665F',
    inverse: '#FFFFFF',
    brand: '#C2003B',
  },

  // Borders & Dividers
  border: {
    subtle: '#E6E2DA',
    medium: '#D5CFC4',
    strong: '#9D9489',
    brand: '#D10040',
  },

  // Interactive Action Mappings
  action: {
    primary: '#D10040',
    primaryHover: '#B30037',
    primaryActive: '#8F002B',
    secondary: '#1C1714',
    destructive: '#C8102E',
  },

  // Operational Status Indicators
  status: {
    success: '#1F8A4C',
    successSubtle: '#E5F3EA',
    warning: '#D97A00',
    warningSubtle: '#FFF0D9',
    danger: '#C8102E',
    dangerSubtle: '#FDEAED',
    info: '#1F5FBF',
    infoSubtle: '#E7EFFB',
  },
} as const;

export type ColorToken = typeof colors;
