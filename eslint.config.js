import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // .impeccable: design mocks and prototypes (the proposal's HTML), not part of the build
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.claude/**', '**/.impeccable/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      // Guardar en localStorage puede fallar (modo privado): esos catch vacíos son intencionados
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/**/*.{js,jsx,ts,tsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['server/**/*.{js,ts}', '*.config.{js,ts}', 'shared/**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
