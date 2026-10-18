import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  envDir: false,
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    'server-only': require.resolve('next/dist/compiled/server-only/empty.js'),
  } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', '.worktrees/**', 'node_modules/**'],
    environment: 'node',
    globals: false,
    isolate: true,
  },
});
