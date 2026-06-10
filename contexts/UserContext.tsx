"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";

interface UserContextType {
  userId: string | null;
  user: any | null;
  loading: boolean;
  setUserId: (id: string | null) => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("userId");
    if (savedId) {
      setUserIdState(savedId);
    }

    // Also check URL on initial load
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get("id");
    if (urlId) {
      setUserIdState(urlId);
      localStorage.setItem("userId", urlId);
      
      // Remove ONLY the 'id' parameter from the URL
      params.delete("id");
      const search = params.toString();
      const query = search ? `?${search}` : "";
      const newUrl = window.location.pathname + query + window.location.hash;
      
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const fetchUser = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user in context:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
    } else {
      setUser(null);
    }
  }, [userId, fetchUser]);

  const setUserId = (id: string | null) => {
    if (id === userId) return; // Prevent redundant updates
    setUserIdState(id);
    if (id) {
      localStorage.setItem("userId", id);
    } else {
      localStorage.removeItem("userId");
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (userId) await fetchUser(userId);
  };

  return (
    <UserContext.Provider value={{ userId, user, loading, setUserId, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}