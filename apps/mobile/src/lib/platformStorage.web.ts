// @react-native-async-storage/async-storage's web shim crashes at import time under Metro's web
// bundling in this setup (its `merge-options` CJS dependency resolves to `undefined`, so
// `mergeOptions.bind({...})` throws "Cannot read properties of undefined" the moment the module
// loads -- not something callers can work around, since it fails before any method is even
// called). The web target is a real browser anyway, so this bypasses that shim entirely and
// talks to `localStorage` directly, which is what the shim would have done internally if it
// worked.
export const platformStorage = {
  async getItem(key: string): Promise<string | null> {
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },
};
