import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tamaguiPlugin } from '@tamagui/vite-plugin';
import path from 'path';

/** Native fs watchers fail on Windows network drives (e.g. mapped V:). */
function shouldUsePolling(root: string): boolean {
  if (process.env.CHOKIDAR_USEPOLLING === 'true') return true;
  if (process.env.CHOKIDAR_USEPOLLING === 'false') return false;
  return root.startsWith('\\\\') || /^V:\\/i.test(root);
}

const projectRoot = __dirname;
const usePolling = shouldUsePolling(projectRoot);

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
    // `@tauri-apps/api/*` is only dynamic-imported (DesktopTrayBridge, task 9.2). Pre-bundling it
    // here means Vite doesn't trigger a mid-load dep re-optimization the first time the desktop
    // shell opens the page -- that re-optimization otherwise races the WebView2's initial load
    // and leaves it blank until a manual reload.
    include: ['react-native-web', '@tauri-apps/api/core', '@tauri-apps/api/event'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  server: {
    port: 5173,
    watch: usePolling
      ? {
          usePolling: true,
          interval: 1000,
        }
      : undefined,
  },
});
