import { defineConfig } from 'vite';

// Builds the self-registering contribution bundle that gets embedded into
// the llm jar and injected into the shell's index.html at runtime.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: '../src/main/resources/META-INF/resources/modules/llm',
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
