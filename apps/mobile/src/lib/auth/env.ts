import { Platform } from 'react-native';

// `localhost` only reaches the host machine on the web preview and iOS simulator (which shares
// the host's network); the Android emulator maps its own loopback, so the host's server is at
// 10.0.2.2 instead. A real device needs the host's LAN IP, which can't be guessed -- set
// EXPO_PUBLIC_API_URL for that case (Expo inlines EXPO_PUBLIC_* vars at build time, same
// convention as apps/web's VITE_API_URL).
const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
};
