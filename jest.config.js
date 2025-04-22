module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.ts', '!src/types/**/*.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1'
    }
  };