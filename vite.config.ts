import react from '@vitejs/plugin-react';
import alchemy from 'alchemy/cloudflare/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), alchemy()],
  server: {
    host: '127.0.0.1',
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
