import { registerWebModule, NativeModule } from 'expo';
import type { FocusBlockNativeModule } from './FocusBlock.types';

// A browser can't watch which "app" is in the foreground outside its own tab -- there is no web
// equivalent of an Android AccessibilityService. lib/focusBlock/api.ts guards every call behind
// Platform.OS === 'android' before reaching this module, so these bodies are an honest backstop
// (same pattern as lib/blocklist/installedApps.web.ts), not something callers are expected to hit.
class FocusBlockModule extends NativeModule<{}> implements FocusBlockNativeModule {
  setBlockingState(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  isAccessibilityServiceEnabled(): boolean {
    return false;
  }

  openAccessibilitySettings(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  isFullScreenIntentAllowed(): boolean {
    return false;
  }

  openFullScreenIntentSettings(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
}

export default registerWebModule(FocusBlockModule, 'FocusBlockModule');
