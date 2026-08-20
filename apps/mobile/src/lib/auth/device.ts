import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Mirrors server's DevicePlatform enum (WEB | ANDROID | IOS | WINDOWS | MACOS) -- register()
// requires this field, login()/OAuth make it optional but send it anyway for consistency.
export const DEVICE_PLATFORM = Platform.select({
  android: 'ANDROID',
  ios: 'IOS',
  default: 'WEB',
}) as 'ANDROID' | 'IOS' | 'WEB';

export function getDeviceLabel(): string {
  const modelName = Constants.deviceName ?? Platform.OS;
  return `${DEVICE_PLATFORM === 'WEB' ? 'Mobile web preview' : modelName} (Expo)`;
}
