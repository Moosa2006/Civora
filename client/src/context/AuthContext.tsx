import { useState, useEffect, type ReactNode } from 'react';
import type { User, AuthResponse } from '../types/auth';
import { AuthContext } from './AuthContextDefinition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.user) {
          setUser(json.data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitialSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && json.data?.user) {
            setUser(json.data.user);
            return;
          }
        }
        if (isMounted) setUser(null);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchInitialSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await res.json();

      if (!res.ok || !data.success || !data.data) {
        return {
          success: false,
          error: data.error?.message || 'Login failed. Please check your credentials.',
          errorCode: data.error?.code,
          details: data.error?.details,
        };
      }

      setUser(data.data.user);
      return { success: true, user: data.data.user };

    } catch {
      return {
        success: false,
        error: 'Unable to connect to the authentication server. Please try again.',
      };
    }
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data: AuthResponse = await res.json();

      if (!res.ok || !data.success || !data.data) {
        return {
          success: false,
          error: data.error?.message || 'Registration failed. Please check your inputs.',
        };
      }

      setUser(data.data.user);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to the registration server. Please try again.',
      };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
