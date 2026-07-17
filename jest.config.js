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
    // otplib publishes ESM-first via package "exports"; force the CJS build
    // for Jest across every import site.
    '^otplib$': '<rootDir>/node_modules/otplib/dist/index.cjs',
    '^otplib/(.*)$': '<rootDir>/node_modules/otplib/dist/$1.cjs',
  },
  // Prefer the `require` conditional export map (Jest 29+).
  testEnvironmentOptions: { customExportConditions: ['node', 'require'] },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true }],
    '^.+\\.js$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true, useESM: false }],
  },
  transformIgnorePatterns: [
    // Whitelist packages that ship ESM-only in node_modules so ts-jest
    // transforms them into CJS before Jest evaluates. otplib and its
    // @otplib/@scure/@noble transitive deps all publish ESM.
    'node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|domelementtype|entities|parse-srcset|postcss|@scure|@noble|otplib|@otplib)/)',
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
