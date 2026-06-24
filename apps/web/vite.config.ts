import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tamaguiPlugin } from '@tamagui/vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tamaguiPlugin({
      config: path.resolve(__dirname, '../../packages/ui/src/tamagui.config.ts'),
      components: ['tamagui'],
    }),
  ],
  resolve: {
    alias: {
      '@calendar/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@calendar/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native-web'),
      'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
    },
  },
  optimizeDeps: {
    include: ['react-native-web'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  server: {
    port: 5173,
  },
});
