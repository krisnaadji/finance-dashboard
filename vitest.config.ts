import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  envDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', '.worktrees/**', 'node_modules/**'],
    environment: 'node',
    globals: false,
    isolate: true,
  },
});
