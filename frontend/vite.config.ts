import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@deck.gl')) return 'deck';
          if (id.includes('maplibre-gl') || id.includes('react-map-gl')) return 'map';
          if (id.includes('framer-motion')) return 'motion';
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
