"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "auth_token";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      // Basic JWT expiry check (decode payload without verification)
      try {
        const payload = JSON.parse(atob(stored.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) {
          setToken(stored);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          return data.error || "Přihlášení selhalo";
        }

        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        return null; // no error
      } catch {
        return "Nelze se připojit k serveru";
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    router.push("/login");
  }, [router]);

  return {
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
  };
}
