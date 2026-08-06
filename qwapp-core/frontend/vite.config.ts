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
      },
      output: {
        // Emit a dedicated ESM entry for lit with stable named exports so
        // extension modules can import from `lit` via the shell's import map.
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'lit' ? 'assets/shared/lit.js' : 'assets/[name]-[hash].js',
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
