import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../src/main/resources/META-INF/resources',
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        shell: 'shell.html',
        lit: 'src/shared/lit.ts',
        'lit-keyed': 'src/shared/lit-keyed.ts',
      },
      output: {
        // Emit dedicated ESM entries for lit with stable named exports so
        // extension modules can import from `lit` (and the directives below)
        // via the import map.
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'lit' || chunkInfo.name === 'lit-keyed'
            ? `assets/shared/${chunkInfo.name}.js`
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
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
