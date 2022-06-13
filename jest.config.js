module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/misc/update-readme.ts'],
  coverageThreshold: {
    global: {
      statements: 43,
      branches: 27,
      functions: 52,
      lines: 42
    }
  },
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true,
  testEnvironment: 'node'
}
