const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

// react-native-launcher-kit's InstalledApps.getApps/getSortedApps (task 6.5) needs this permission
// on Android 11+ (API 30+) to see packages outside the "package visibility" allowlist -- see
// https://developer.android.com/training/package-visibility. Injected via a plugin (not committed
// directly to android/app/src/main/AndroidManifest.xml) so it survives `expo prebuild` re-runs
// instead of being wiped every time the native project is regenerated.
const QUERY_ALL_PACKAGES_PERMISSION = 'android.permission.QUERY_ALL_PACKAGES';

module.exports = function withQueryAllPackagesPermission(config) {
  return withAndroidManifest(config, (config) => {
    // ensurePermissions mutates `androidManifest` in place and returns a
    // { [permissionName]: boolean } status report, NOT the manifest -- assigning its return value
    // back into config.modResults (an earlier version of this plugin did) overwrites the entire
    // real manifest with that status object, which then gets serialized as bogus XML. Found via a
    // real `gradlew assembleDebug` run once the local Android SDK was set up (see design.md
    // decision 34 update): the resulting AndroidManifest.xml was just
    // `<android.permission.QUERY_ALL_PACKAGES>true</android.permission.QUERY_ALL_PACKAGES>`, with
    // the entire rest of the manifest gone.
    AndroidConfig.Permissions.ensurePermissions(config.modResults, [QUERY_ALL_PACKAGES_PERMISSION]);
    return config;
  });
};
