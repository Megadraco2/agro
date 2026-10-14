module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { rootDir: '.' } }] },
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
};
