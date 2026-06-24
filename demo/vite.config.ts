import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // The package is linked via `file:..`, so dedupe the React/AI-SDK copies the
    // symlinked package would otherwise resolve from its own node_modules.
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', '@ai-sdk/react', 'ai'],
  },
  base: '/',
});
