export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  appleClientId: import.meta.env.VITE_APPLE_CLIENT_ID ?? '',
};
