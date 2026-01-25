import react from '@vitejs/plugin-react';
import alchemy from 'alchemy/cloudflare/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), alchemy()],
  server: {
    proxy: {
      '/run': 'http://localhost:1337',
      '/terminal': 'http://localhost:1337'
    }
  }
});
