import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { clearSession, loadSession, saveSession } from '../lib/auth-storage';
import type { AuthUser, LoginInput, RegisterInput } from '../lib/auth-types';
import {
  fetchProfile,
  login as apiLogin,
  loginWithApple as apiLoginWithApple,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  register as apiRegister,
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const session = loadSession();
      if (!session) {
        if (isMounted) setIsLoading(false);
        return;
      }

      if (isMounted) setUser(session.user);

      try {
        const profile = await fetchProfile();
        const current = loadSession();

        if (current) {
          saveSession({ ...current, user: profile });
        }

        if (isMounted) {
          setUser(profile);
        }
      } catch {
        clearSession();
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

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const session = await apiLoginWithGoogle(idToken);
    setUser(session.user);
  }, []);

  const loginWithApple = useCallback(async (idToken: string) => {
    const session = await apiLoginWithApple(idToken);
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
      loginWithGoogle,
      loginWithApple,
      logout,
    }),
    [isLoading, login, loginWithApple, loginWithGoogle, logout, register, user],
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
