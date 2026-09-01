import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This is the Taleo-replica redesign frontend (foos_redesign_2) — a second,
// interchangeable frontend against the same Supabase backend as /foos.
// Pinned to a distinct port (strictPort so it fails loudly instead of
// silently picking another one) so both frontends can run side by side:
// /foos on 5173 (default), /foos_redesign on 5174, this one on 5175.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
  build: {
    // The original dist/ carried over from the rsync copy (and, it turns
    // out, this dir's own prior build output too) has files the sandbox's
    // file-sync layer won't let us unlink — a recurring quirk of this
    // mount, not a real permissions problem. emptyOutDir:false plus
    // per-build-hash filenames means Vite just adds new hashed assets
    // instead of needing to delete the old ones.
    outDir: 'dist-redesign-2',
    emptyOutDir: false,
  },
});
