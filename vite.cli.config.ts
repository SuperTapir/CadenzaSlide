import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'src/apps/cli/cadenza-bin.ts',
    outDir: 'dist-cli',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'cli/cadenza.js' },
    },
  },
})
