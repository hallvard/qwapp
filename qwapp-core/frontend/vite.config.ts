import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../src/main/resources/META-INF/resources',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Give `lit` a stable, unhashed path so extension modules can import
        // it externally (via an import map) instead of bundling their own copy.
        manualChunks(id) {
          if (id.includes('node_modules/lit') || id.includes('node_modules/@lit')) {
            return 'lit';
          }
        },
        chunkFileNames: (chunkInfo) =>
          chunkInfo.name === 'lit' ? 'assets/shared/lit.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/q': 'http://localhost:8080',
    },
  },
});
