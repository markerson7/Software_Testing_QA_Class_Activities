export default {
    testEnvironment: 'node',
    testMatch: ['**/tests/jest/**/*.test.js'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    transform: {},
    testPathIgnorePatterns: ['/node_modules/', '/tests/mocha/', ],

}