module.exports = {
    testEnvironment: 'jsdom',
    transform: { '^.+\\.js$': 'babel-jest' },
    moduleNameMapper: { '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js' },
    setupFiles: ['./jest.setup.js'],
    globals: {
        __APP_BUILD__: 'test',
        __BUILD_DATE__: '2099-01-01 00:00 CEST',
        __FEATURE_LOD__: true,
    },
    collectCoverageFrom: [
        'js/shared/**/*.js',
        'js/domino/**/*.js',
        'js/solitaire/**/*.js',
        '!js/domino/init.js',
        '!js/solitaire/init.js',
    ],
    coverageThreshold: { global: { statements: 82, branches: 70, functions: 75, lines: 86 } },
    testMatch: ['**/__tests__/**/*.test.js'],
};
