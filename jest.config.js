module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/misc/update-readme.ts'],
  coverageThreshold: {
    global: {
      statements: 98,
      branches: 95,
      functions: 96,
      lines: 98
    }
  },
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true,
  testEnvironment: 'node'
}
