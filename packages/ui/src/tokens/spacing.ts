/**
 * YellowShifts Semantic Design Tokens: Spacing
 *
 * Incremental spacing scale mapped to exact pixel/rem values.
 */

export const spacing = {
  space2: '2px',
  space4: '4px',
  space6: '6px',
  space8: '8px',
  space10: '10px',
  space12: '12px',
  space14: '14px',
  space16: '16px',
  space20: '20px',
  space24: '24px',
  space32: '32px',
  space40: '40px',
  space48: '48px',
  space64: '64px',
} as const;

export type SpacingToken = keyof typeof spacing;
