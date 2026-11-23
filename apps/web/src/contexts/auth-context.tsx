"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { User, LoginResponseData, RegisterResponseData } from "@/types/auth";
import {
  apiRequest,
  setAccessToken as setClientAccessToken,
  refreshSession,
  setOnTokenExpired,
  ApiClientError,
} from "@/lib/api-client";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const isHydrating = useRef(false);

  // Sync token with centralized API client
  const updateToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setClientAccessToken(token);
  }, []);

  // Fetch current user from /auth/me
  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await apiRequest<{ user: User }>("/auth/me");
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      return null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (isHydrating.current) return;
    isHydrating.current = true;

    async function initAuth() {
      try {
        const token = await refreshSession();
        if (token) {
          updateToken(token);
          await fetchCurrentUser();
        } else {
          updateToken(null);
          setUser(null);
        }
      } catch {
        updateToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    // Register token expiration handler
    setOnTokenExpired(() => {
      updateToken(null);
      setUser(null);
      router.push("/login?expired=1");
    });
  }, [fetchCurrentUser, updateToken, router]);

  // Login handler
  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<LoginResponseData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      if (res.data?.accessToken && res.data.user) {
        updateToken(res.data.accessToken);
        setUser(res.data.user);
      } else {
        throw new ApiClientError(500, "Unexpected login response format");
      }
    },
    [updateToken]
  );

  // Register handler (Note: Registration does not log in user per backend contract)
  const register = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      const res = await apiRequest<RegisterResponseData>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, confirmPassword }),
        skipAuth: true,
      });

      if (!res.data?.user) {
        throw new ApiClientError(500, "Unexpected register response format");
      }

      return res.data.user;
    },
    []
  );

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.warn("Logout request error:", err);
    } finally {
      updateToken(null);
      setUser(null);
      router.push("/login");
    }
  }, [updateToken, router]);

  const refreshUser = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
