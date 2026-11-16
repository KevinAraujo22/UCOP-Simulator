import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ucop.simulator',
  appName: 'UCOP',
  webDir: 'dist',
  server: {
    // http://localhost dentro do APK: permite falar com servidores http na rede local
    // (ex.: http://192.168.0.10:3333) sem bloqueio de "conteúdo misto". Links https do
    // Cloudflare Tunnel também funcionam.
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0f0d14',
  },
};

export default config;
