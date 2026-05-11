/** @type {import('jest').Config} */
export default {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/misc/update-readme.ts'],
  coverageThreshold: {
    global: {
      statements: 98,
      branches: 94,
      functions: 97,
      lines: 98
    }
  },
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        useESM: false
      }
    ]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testEnvironmentOptions: {
    customExportConditions: ['import', 'node']
  },
  verbose: true,
  testEnvironment: 'node'
}
