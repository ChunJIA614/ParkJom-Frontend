import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ||
    'https://parkjom-api-gbgcbycbcjghczgu.malaysiawest-01.azurewebsites.net';

  return {
    plugins: [react(), tailwindcss(), mkcert() ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: !apiProxyTarget.includes('localhost'),
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

