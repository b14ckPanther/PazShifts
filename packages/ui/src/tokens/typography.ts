/**
 * YellowShifts Semantic Design Tokens: Typography
 *
 * Font stacks:
 * - Hebrew (RTL): Heebo, -apple-system, sans-serif
 * - English (LTR): Ubuntu, -apple-system, sans-serif
 */

export const typography = {
  fonts: {
    hebrew: 'var(--font-heebo), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    english:
      'var(--font-ubuntu), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sizes: {
    displayLarge: {
      fontSize: '32px',
      lineHeight: '1.2',
      fontWeight: '700',
    },
    titleLarge: {
      fontSize: '22px',
      lineHeight: '1.25',
      fontWeight: '600',
    },
    titleMedium: {
      fontSize: '17px',
      lineHeight: '1.3',
      fontWeight: '600',
    },
    bodyLarge: {
      fontSize: '16px',
      lineHeight: '1.45',
      fontWeight: '400',
    },
    bodyMedium: {
      fontSize: '14px',
      lineHeight: '1.4',
      fontWeight: '400',
    },
    bodyStrong: {
      fontSize: '14px',
      lineHeight: '1.4',
      fontWeight: '600',
    },
    labelLarge: {
      fontSize: '14px',
      lineHeight: '1.2',
      fontWeight: '500',
    },
    caption: {
      fontSize: '12px',
      lineHeight: '1.35',
      fontWeight: '400',
    },
    numericLarge: {
      fontSize: '28px',
      lineHeight: '1.1',
      fontWeight: '700',
      letterSpacing: '-0.5px',
    },
    numericCompact: {
      fontSize: '15px',
      lineHeight: '1.2',
      fontWeight: '600',
    },
  },
} as const;
