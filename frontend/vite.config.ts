// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     exclude: ['lucide-react'],
//   },
// });

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    strictPort: true,
    port: 3000,
    mimeTypes: {
      'application/javascript': ['js', 'ts', 'tsx']
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  esbuild: {
    loader: 'tsx',
  },
});
  
