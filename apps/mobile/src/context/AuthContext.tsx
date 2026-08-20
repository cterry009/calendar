import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchProfile, login as apiLogin, logout as apiLogout, register as apiRegister } from '../lib/auth/api';
import { clearSession, loadSession, saveSession } from '../lib/auth/storage';
import type { AuthUser, LoginInput, RegisterInput } from '../lib/auth/types';

// OAuth (Google/Apple) is deliberately not ported here -- apps/web's OAuthButtons.tsx loads
// platform JS SDKs in the browser, which has no native equivalent; that needs
// expo-auth-session/@react-native-google-signin + expo-apple-authentication, a separate task.
interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const session = await loadSession();
      if (!session) {
        if (isMounted) setIsLoading(false);
        return;
      }

      if (isMounted) setUser(session.user);

      try {
        const profile = await fetchProfile();
        const current = await loadSession();

        if (current) {
          await saveSession({ ...current, user: profile });
        }

        if (isMounted) {
          setUser(profile);
        }
      } catch {
        await clearSession();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await apiLogin(input);
    setUser(session.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await apiRegister(input);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [isLoading, login, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
