import { defineConfig } from 'vite';

// Builds the self-registering contribution bundle that gets embedded into
// the ol-map jar and injected into the shell's HTML at runtime.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: '../src/main/resources/META-INF/resources/modules/ol-map',
    emptyOutDir: true,
    lib: {
      entry: 'src/module.ts',
      formats: ['es'],
      fileName: () => 'module.js',
    },
    rollupOptions: {
      // Provided by the shell's import map instead of bundling our own copy.
      external: ['lit'],
    },
  },
});
