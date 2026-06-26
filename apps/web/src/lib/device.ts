const STORAGE_KEY = 'calendar.deviceLabel';

export function getDeviceLabel(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const ua = navigator.userAgent.replace(/\s+/g, ' ').slice(0, 80);
  const label = ua ? `Web — ${ua}` : 'Web Browser';
  localStorage.setItem(STORAGE_KEY, label);
  return label;
}

export const DEVICE_PLATFORM = 'WEB' as const;
