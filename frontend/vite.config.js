import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  /** Relative asset URLs for Electron `loadFile` (file://). */
  const isElectronBuild = mode === 'electron';
  return {
    base: isElectronBuild ? './' : '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': 'http://localhost:4000',
        '/device-agent': {
          target: 'http://127.0.0.1:39471',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/device-agent/, '')
        },
        '/license': {
          target: 'http://127.0.0.1:5050',
          changeOrigin: true
        },
        '/socket.io': {
          target: 'http://localhost:4000',
          ws: true
        }
      }
    }
  };
});
