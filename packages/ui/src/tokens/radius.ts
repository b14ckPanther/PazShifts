/**
 * YellowShifts Semantic Design Tokens: Border Radius
 */

export const radius = {
  xs: '6px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '26px',
  pill: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;
