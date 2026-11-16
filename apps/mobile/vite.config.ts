import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// O app reaproveita telas e fichas do site (apps/web/src) pelo apelido "@web".
const web = fileURLToPath(new URL('../web/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@web': web } },
  publicDir: fileURLToPath(new URL('../web/public', import.meta.url)),
  // Caminhos relativos: o Capacitor serve os arquivos de dentro do APK.
  base: './',
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
