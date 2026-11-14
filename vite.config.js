import { defineConfig } from 'vite';

export default defineConfig({
  base: '/particle-heart-3d/',
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 650,
  },
});
