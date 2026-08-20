const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

// react-native-launcher-kit's InstalledApps.getApps/getSortedApps (task 6.5) needs this permission
// on Android 11+ (API 30+) to see packages outside the "package visibility" allowlist -- see
// https://developer.android.com/training/package-visibility. Injected via a plugin (not committed
// directly to android/app/src/main/AndroidManifest.xml) so it survives `expo prebuild` re-runs
// instead of being wiped every time the native project is regenerated.
const QUERY_ALL_PACKAGES_PERMISSION = 'android.permission.QUERY_ALL_PACKAGES';

module.exports = function withQueryAllPackagesPermission(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Permissions.ensurePermissions(config.modResults, [
      QUERY_ALL_PACKAGES_PERMISSION,
    ]);
    return config;
  });
};
