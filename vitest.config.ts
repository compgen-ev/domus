import { defineConfig } from 'vitest/config';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  plugins: [
    Icons({
      compiler: 'raw',
      autoInstall: false,
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
