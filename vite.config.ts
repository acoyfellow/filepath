import react from '@vitejs/plugin-react';
import alchemy from 'alchemy/cloudflare/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), alchemy()],
  server: {
    proxy: {
      '/run': {
        target: 'http://localhost:1337',
        ws: true
      },
      '/terminal': {
        target: 'http://localhost:1337',
        ws: true
      },
      '/session': {
        target: 'http://localhost:1337',
        ws: true
      }
    }
  }
});
