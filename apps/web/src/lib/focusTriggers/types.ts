import type { FocusTriggerKind } from '@calendar/shared';

export interface SyncFocusTriggerRecord {
  id: string;
  kind: FocusTriggerKind;
  label: string;
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  wifiSsid: string | null;
  updatedAt: string;
}

export interface FocusTriggerFormValues {
  kind: FocusTriggerKind;
  label: string;
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  wifiSsid: string | null;
}

export const FOCUS_TRIGGER_KINDS: FocusTriggerKind[] = ['LOCATION', 'WIFI'];

export const DEFAULT_RADIUS_METERS = 150;
