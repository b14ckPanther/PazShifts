/**
 * YellowShifts Semantic Design Tokens: Border Radius
 */

export const radius = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  pill: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;
