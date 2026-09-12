import base from '../../eslint.config.mjs';
export default [
  ...base,
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            '@yellowshifts/database',
            '@yellowshifts/ui',
            '@yellowshifts/icons',
            '@supabase/ssr',
            'next',
          ],
          patterns: [
            '@yellowshifts/database/src/*',
            '@yellowshifts/database/src/**',
            '@yellowshifts/ui/*',
            '@yellowshifts/icons/*',
            'next/*',
            'node:*',
          ],
        },
      ],
    },
  },
];
