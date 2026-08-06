import { defineConfig } from 'vite';

// Used only for standalone component preview (`npm run dev`), mounting
// ol-map-view eagerly into index.html. The production contribution
// bundle is built separately via vite.module.config.ts.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8083',
      '/q': 'http://localhost:8083',
    },
  },
});
