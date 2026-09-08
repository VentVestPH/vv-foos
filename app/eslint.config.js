import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const MODULES = ['dashboards', 'intake', 'recruit', 'sales', 'settings'];

const moduleIsolation = MODULES.map((self) => ({
  files: [`src/modules/${self}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': 'off',
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: MODULES.filter((other) => other !== self).flatMap((other) => [
              `**/${other}`,
              `**/${other}/**`,
            ]),
            message:
              'Modules are self-contained: they must not import each other. Move the shared piece into src/lib, src/components or src/shell.',
          },
        ],
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'vite.config.ts.timestamp-*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  ...moduleIsolation,
  {
    files: ['src/modules/dashboards/db.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
