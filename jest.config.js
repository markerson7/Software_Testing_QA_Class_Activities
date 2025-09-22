export default {
  testEnvironment: "node",
  testMatch: ["**/tests/jest/**/*.test.js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {},
  testPathIgnorePatterns: ["/node_modules/", "/tests/mocha/"],

  // ✅ Fix module resolution issues
  moduleDirectories: ["node_modules", "<rootDir>"],

  // ✅ Prevent teardown race conditions
  testTimeout: 60000,
  
  // ✅ Setup files to load environment variables
  setupFilesAfterEnv: ["<rootDir>/tests/jest/setup.js"],
  
  // ✅ Run tests sequentially to avoid database conflicts
  maxWorkers: 1,
  
  // ✅ Detect open handles to prevent hanging
  detectOpenHandles: true,
  forceExit: true,
  
  // ✅ Verbose output for debugging
  verbose: true
};