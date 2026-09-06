/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  modulePathIgnorePatterns: ['<rootDir>/work/'],
};
