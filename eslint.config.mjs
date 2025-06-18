import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
  eslint.configs.recommended,  
  tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  jest.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        allowDefaultProject: ['*.js', '*.mjs'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ['src/**/*.ts'],
    ignores: ['dist/', 'lib/', 'node_modules/', 'jest.config.js'],
  },
);