import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = Number(process.env.FOOS_PORT ?? 5175);

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    watch: {
      ignored: ['**/dist/**'],
    },
  },
  preview: {
    port,
    strictPort: true,
  },
  build: {

    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
