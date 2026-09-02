import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    watch: {
      ignored: ['**/dist/**', '**/dist-redesign-2/**'],
    },
  },
  preview: {
    port: 5175,
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
    outDir: 'dist-redesign-2',
    emptyOutDir: true,
  },
});
