"use client";

import { createContext, useCallback, useContext, useRef } from "react";

interface WelcomeContextValue {
  open: (forceRefresh?: boolean) => void;
  /** Internal: called by WelcomeScreen to register itself */
  _register: (handler: (forceRefresh: boolean) => void) => void;
}

const WelcomeContext = createContext<WelcomeContextValue>({
  open: () => {},
  _register: () => {},
});

export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<((forceRefresh: boolean) => void) | null>(null);

  const register = useCallback((handler: (forceRefresh: boolean) => void) => {
    handlerRef.current = handler;
  }, []);

  const open = useCallback((forceRefresh = false) => {
    handlerRef.current?.(forceRefresh);
  }, []);

  return (
    <WelcomeContext.Provider value={{ open, _register: register }}>
      {children}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  return useContext(WelcomeContext);
}
