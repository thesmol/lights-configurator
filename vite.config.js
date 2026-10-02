import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES_REPO ? `/${process.env.GITHUB_PAGES_REPO}/` : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
