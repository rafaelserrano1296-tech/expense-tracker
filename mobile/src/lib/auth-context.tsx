import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

import { api, clearToken, getToken, setToken } from '@/lib/api';

type User = { id: number; email: string };

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const stored = await readStoredUser();
        setUser(stored);
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    await setToken(res.token);
    await writeStoredUser(res.user);
    setUser(res.user);
  }

  async function signup(email: string, password: string) {
    const res = await api.signup(email, password);
    await setToken(res.token);
    await writeStoredUser(res.user);
    setUser(res.user);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const USER_KEY = 'auth_user';

async function readStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function writeStoredUser(user: User) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}
