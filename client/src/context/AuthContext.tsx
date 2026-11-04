import { useState, useEffect, type ReactNode } from 'react';
import type { User, AuthResponse } from '../types/auth';
import { AuthContext } from './AuthContextDefinition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('civora_token') : null;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me', {
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.user) {
          setUser(json.data.user);
          return;
        }
      }
      if (res.status === 401) {
        localStorage.removeItem('civora_token');
        localStorage.removeItem('civora_user');
        setUser(null);
        return;
      }
      const cached = typeof window !== 'undefined' ? localStorage.getItem('civora_user') : null;
      if (cached) {
        try {
          setUser(JSON.parse(cached));
          return;
        } catch {}
      }
      setUser(null);
    } catch {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('civora_user') : null;
      if (cached) {
        try {
          setUser(JSON.parse(cached));
          return;
        } catch {}
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitialSession = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('civora_token') : null;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/auth/me', {
          headers,
          credentials: 'include',
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && json.data?.user) {
            setUser(json.data.user);
            return;
          }
        }
        if (res.status === 401) {
          localStorage.removeItem('civora_token');
          localStorage.removeItem('civora_user');
          if (isMounted) setUser(null);
          return;
        }
        const cached = typeof window !== 'undefined' ? localStorage.getItem('civora_user') : null;
        if (cached && isMounted) {
          try {
            setUser(JSON.parse(cached));
            return;
          } catch {}
        }
        if (isMounted) setUser(null);
      } catch {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('civora_user') : null;
        if (cached && isMounted) {
          try {
            setUser(JSON.parse(cached));
            return;
          } catch {}
        }
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

      let data: AuthResponse | null = null;
      try {
        data = await res.json();
      } catch {
        return {
          success: false,
          error: res.status >= 500
            ? 'The backend server is warming up or temporarily unavailable. Please retry in a few seconds.'
            : 'Authentication server response could not be parsed.',
        };
      }

      if (!res.ok || !data?.success || !data?.data) {
        return {
          success: false,
          error: data?.error?.message || 'Login failed. Please check your credentials.',
          errorCode: data?.error?.code,
          details: data?.error?.details,
        };
      }

      if (data.data.token) {
        localStorage.setItem('civora_token', data.data.token);
      }
      localStorage.setItem('civora_user', JSON.stringify(data.data.user));
      setUser(data.data.user);
      return { success: true, user: data.data.user };

    } catch {
      return {
        success: false,
        error: 'Unable to connect to the authentication server. Please check your network and try again.',
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

      let data: AuthResponse | null = null;
      try {
        data = await res.json();
      } catch {
        return {
          success: false,
          error: 'Registration server is currently unavailable. Please try again shortly.',
        };
      }

      if (!res.ok || !data?.success || !data?.data) {
        return {
          success: false,
          error: data?.error?.message || 'Registration failed. Please check your inputs.',
        };
      }

      if (data.data?.token) {
        localStorage.setItem('civora_token', data.data.token);
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
      localStorage.removeItem('civora_token');
      localStorage.removeItem('civora_user');
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
