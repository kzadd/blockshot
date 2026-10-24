import { defineConfig } from 'tsup';

// One self-contained file: the shared package is TypeScript source, so it is bundled in
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  clean: true,
  noExternal: ['@blockshot/shared'],
});
