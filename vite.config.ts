import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vite';

// Resolve project root for path aliases in ESM context.
const rootDir = dirname(fileURLToPath(import.meta.url));

// GitHub Pages requires a non-root base when hosted under /<repo>/.
const basePath = process.env.GITHUB_PAGES === 'true' ? '/dc-manager/' : '/';

export default defineConfig({
  // Base URL ensures assets resolve correctly on GitHub Pages.
  base: basePath,
  root: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src')
    }
  },
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['../src/test/setup.ts']
  }
});
