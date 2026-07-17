/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true }],
    '^.+\\.js$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true, useESM: false }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|domelementtype|entities|parse-srcset|postcss)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/dto/*.ts',
    '!src/database/entities/*.ts',
    '!src/database/migrations/*.ts',
    '!src/database/seed.ts',
    '!src/database/data-source.ts',
    '!src/database/index.ts',
    '!src/types/**/*',
  ],
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
  testTimeout: 30000,
  clearMocks: true,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
