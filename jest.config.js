module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/misc/update-readme.ts'],
  coverageThreshold: {
    global: {
      statements: 73,
      branches: 52,
      functions: 84,
      lines: 73
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
