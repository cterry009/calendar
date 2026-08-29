import { Platform } from 'react-native';
import { SdkAvailabilityStatus, aggregateRecord, getSdkStatus, initialize, requestPermission } from 'react-native-health-connect';

// Task 11.3. Health Connect reads the step total the phone's own always-on hardware sensor hub
// has already been accumulating regardless of whether this app was open -- unlike
// Pedometer.watchStepCount() (useDailySteps.ts's other branch), which only ever sees deltas while
// this app is specifically in the foreground. Chosen over a custom foreground service: a service
// would need a persistent notification just to keep a process alive to do something the OS
// already does for free (see design.md's decision for this task).
const STEPS_READ_PERMISSION = { accessType: 'read', recordType: 'Steps' } as const;

// Real device finding, not from documentation: androidx.health.connect:connect-client 1.1.0's
// getSdkStatus()/initialize() only ever check ONE hardcoded package name by default --
// "com.google.android.apps.healthdata" (confirmed by grepping the compiled library's strings,
// it's the only Health Connect package name baked into the jar at all) -- the standalone Play
// Store app used on Android 10-13. On a real Android 14+ device (Samsung Galaxy S23, Android 16),
// Health Connect ships as an OS module under a *different* package,
// "com.google.android.healthconnect.controller", which the library's default check never finds,
// so isHealthConnectAvailable() returned false even with Health Connect genuinely present and
// enabled. Try both, in this order (the pre-14 standalone app first since that's the library's
// own default/most-tested path, then the Android 14+ platform module name).
const CANDIDATE_PROVIDER_PACKAGES = ['com.google.android.apps.healthdata', 'com.google.android.healthconnect.controller'];

let initializedPromise: Promise<string | null> | null = null;

// Resolves to the provider package name that actually works, or null if Health Connect isn't
// usable via any known package name. A real native round-trip per candidate -- cached per app
// session (only re-probed on a fresh process) rather than re-checked on every read.
async function ensureInitialized(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  if (!initializedPromise) {
    initializedPromise = (async () => {
      for (const providerPackageName of CANDIDATE_PROVIDER_PACKAGES) {
        const status = await getSdkStatus(providerPackageName);
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) continue;
        if (await initialize(providerPackageName)) return providerPackageName;
      }
      return null;
    })();
  }
  return initializedPromise;
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  return (await ensureInitialized()) !== null;
}

export async function requestStepsPermission(): Promise<boolean> {
  if ((await ensureInitialized()) === null) return false;
  const granted = await requestPermission([STEPS_READ_PERMISSION]);
  return granted.some((permission) => permission.recordType === 'Steps' && permission.accessType === 'read');
}

// Reads the total Health Connect has recorded for the given local calendar day, aggregated across
// every source contributing to it (the phone's own sensor hub, plus any other app writing Steps
// records) -- not just this app's own sessions.
export async function readDailySteps(dayKey: string): Promise<number> {
  if ((await ensureInitialized()) === null) return 0;
  const startTime = new Date(`${dayKey}T00:00:00`).toISOString();
  const endTime = new Date(`${dayKey}T23:59:59.999`).toISOString();
  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', startTime, endTime },
  });
  return result.COUNT_TOTAL ?? 0;
}
