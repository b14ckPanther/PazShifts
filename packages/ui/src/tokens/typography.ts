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
      fontSize: '1.625rem',
      lineHeight: '1.2',
      fontWeight: '800',
    },
    titleLarge: {
      fontSize: '1.25rem',
      lineHeight: '1.25',
      fontWeight: '600',
    },
    titleMedium: {
      fontSize: '1.0625rem',
      lineHeight: '1.3',
      fontWeight: '600',
    },
    bodyLarge: {
      fontSize: '0.9375rem',
      lineHeight: '1.45',
      fontWeight: '400',
    },
    bodyMedium: {
      fontSize: '0.8125rem',
      lineHeight: '1.4',
      fontWeight: '400',
    },
    bodyStrong: {
      fontSize: '0.8125rem',
      lineHeight: '1.4',
      fontWeight: '600',
    },
    labelLarge: {
      fontSize: '0.8125rem',
      lineHeight: '1.2',
      fontWeight: '500',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: '1.35',
      fontWeight: '400',
    },
    numericLarge: {
      fontSize: '2rem',
      lineHeight: '1.1',
      fontWeight: '700',
      letterSpacing: '-0.5px',
    },
    numericCompact: {
      fontSize: '0.9375rem',
      lineHeight: '1.2',
      fontWeight: '600',
    },
  },
} as const;
