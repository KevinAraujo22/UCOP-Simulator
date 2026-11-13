import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.UCOP_API ?? 'http://127.0.0.1:3333';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          konva: ['konva', 'react-konva'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
