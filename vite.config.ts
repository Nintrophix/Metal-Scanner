import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // The lazily loaded 3D preview chunk is three.js itself (~520 kB, ~133 kB gzip).
  build: { chunkSizeWarningLimit: 560 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
