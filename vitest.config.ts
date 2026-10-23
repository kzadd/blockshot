import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/src/**/*.test.ts', '**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000,
    hookTimeout: 30000,
    // The end-to-end suites each start their own server process
    fileParallelism: true,
  },
});
