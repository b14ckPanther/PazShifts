/**
 * YellowShifts Semantic Design Tokens: Colors
 *
 * Extracted with 100% precision from the legacy brand system:
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
    yellowAccent: '#FFDB07',
    yellowSubtle: '#FFF7CC',
    crimson: '#D10040',
    crimsonHover: '#B00036',
    crimsonActive: '#8F002B',
  },

  // Application Surfaces
  surface: {
    base: '#F6F6F6',
    raised: '#FFFFFF',
    muted: '#EFEFEF',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // Typography & Content
  text: {
    primary: '#000000',
    secondary: '#555555',
    muted: '#8E8E93',
    inverse: '#FFFFFF',
    brand: '#D10040',
  },

  // Borders & Dividers
  border: {
    subtle: '#E5E5EA',
    medium: '#D1D1D6',
    strong: '#8E8E93',
    brand: '#D10040',
  },

  // Interactive Action Mappings
  action: {
    primary: '#D10040',
    primaryHover: '#B00036',
    primaryActive: '#8F002B',
    secondary: '#000000',
    destructive: '#D10040',
  },

  // Operational Status Indicators
  status: {
    success: '#34C759',
    successSubtle: '#E8F9ED',
    warning: '#FF9500',
    warningSubtle: '#FFF4E5',
    danger: '#D10040',
    dangerSubtle: '#FFEBEF',
    info: '#007AFF',
    infoSubtle: '#EBF5FF',
  },
} as const;

export type ColorToken = typeof colors;
