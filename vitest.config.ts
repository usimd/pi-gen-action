import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/misc/update-readme.ts'],
      thresholds: {
        statements: 98,
        branches: 94,
        functions: 97,
        lines: 98
      }
    }
  }
})
