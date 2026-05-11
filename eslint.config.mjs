import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,  
  tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    plugins: {vitest},
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        allowDefaultProject: ['*.js', '*.mjs'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ['src/**/*.ts'],
    ignores: ['dist/', 'lib/', 'node_modules/'],
  },
);