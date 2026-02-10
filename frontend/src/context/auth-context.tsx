"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<any>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendOTP: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "intervueai_token";
const USER_KEY = "intervueai_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsed);

        // Verify token is still valid
        fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (!res.ok) {
              // Token expired or invalid
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              document.cookie = "intervueai_auth=; path=/; max-age=0";
              setToken(null);
              setUser(null);
            }
          })
          .catch(() => {
            // Network error — keep session, user might be offline
          })
          .finally(() => setIsLoading(false));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const saveSession = useCallback((accessToken: string, userData: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    // Set a cookie so Next.js middleware can detect auth status
    document.cookie = `intervueai_auth=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    setToken(accessToken);
    setUser(userData);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(err.detail || "Login failed");
      }

      const data = await res.json();
      saveSession(data.access_token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      });
    },
    [saveSession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Registration failed" }));
        throw new Error(err.detail || "Registration failed");
      }

      return await res.json();
    },
    []
  );

  const verifyEmail = useCallback(
    async (email: string, otp: string) => {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Verification failed" }));
        throw new Error(err.detail || "Verification failed");
      }

      const data = await res.json();
      saveSession(data.access_token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      });
    },
    [saveSession]
  );

  const resendOTP = useCallback(async (email: string) => {
    const res = await fetch(`${API_URL}/api/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to resend OTP" }));
      throw new Error(err.detail || "Failed to resend OTP");
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Clear the auth cookie
    document.cookie = "intervueai_auth=; path=/; max-age=0";
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, verifyEmail, resendOTP, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
