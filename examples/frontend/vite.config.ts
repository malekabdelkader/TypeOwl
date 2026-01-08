import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      'typeowl/types': path.resolve(__dirname, './.typeowl'),
    },
  },
  
  server: {
    port: 5173,
    
    // Proxy API requests to the backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/__typeowl': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  
  // Multi-page app build configuration
  build: {
    rollupOptions: {
      input: {
        // Landing page (static HTML at root)
        main: path.resolve(__dirname, 'index.html'),
        // Examples page (React app)
        examples: path.resolve(__dirname, 'examples.html'),
      },
    },
    outDir: 'dist',
  },
});
