import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import github from 'eslint-plugin-github';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  github.getFlatConfigs().browser,
  github.getFlatConfigs().recommended,
  github.getFlatConfigs().react,
  ...github.getFlatConfigs().typescript,
  jest.configs['flat/recommended'],
  prettier,
);