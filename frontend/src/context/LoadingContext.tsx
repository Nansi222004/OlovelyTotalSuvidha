import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  isRouteLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  startRouteLoading: () => void;
  stopRouteLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(true); // Default to true for full page reload
  const loadingStartTime = useRef<number | null>(null);
  const routeLoadingStartTime = useRef<number | null>(Date.now()); // Start timing immediately
  const activeRequests = useRef(0);
  const activeRouteRequests = useRef(1); // Start with 1 to represent initial page load
  const MINIMUM_LOADING_TIME = 1000; // 1 second

  const safetyTimer = useRef<NodeJS.Timeout | null>(null);
  const routeSafetyTimer = useRef<NodeJS.Timeout | null>(null);

  // --- API / General Loading ---
  const startLoading = useCallback(() => {
    activeRequests.current += 1;
    if (activeRequests.current === 1) {
      loadingStartTime.current = Date.now();
      setIsLoading(true);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => {
        if (activeRequests.current > 0) {
          activeRequests.current = 0;
          setIsLoading(false);
        }
      }, 15000);
    }
  }, []);

  const stopLoading = useCallback(() => {
    activeRequests.current = Math.max(0, activeRequests.current - 1);
    if (activeRequests.current === 0) {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
      const now = Date.now();
      const startTime = loadingStartTime.current || now;
      const elapsed = now - startTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsed);
      setTimeout(() => {
        if (activeRequests.current === 0) {
          setIsLoading(false);
          loadingStartTime.current = null;
        }
      }, remainingTime);
    }
  }, []);

  // --- Route / Reload Loading ---
  const startRouteLoading = useCallback(() => {
    activeRouteRequests.current += 1;
    if (activeRouteRequests.current === 1) {
      routeLoadingStartTime.current = Date.now();
      setIsRouteLoading(true);
      if (routeSafetyTimer.current) clearTimeout(routeSafetyTimer.current);
      routeSafetyTimer.current = setTimeout(() => {
        if (activeRouteRequests.current > 0) {
          activeRouteRequests.current = 0;
          setIsRouteLoading(false);
        }
      }, 10000); // 10s safety for routes
    }
  }, []);

  const stopRouteLoading = useCallback(() => {
    activeRouteRequests.current = Math.max(0, activeRouteRequests.current - 1);
    if (activeRouteRequests.current === 0) {
      if (routeSafetyTimer.current) {
        clearTimeout(routeSafetyTimer.current);
        routeSafetyTimer.current = null;
      }
      const now = Date.now();
      const startTime = routeLoadingStartTime.current || now;
      const elapsed = now - startTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsed);
      setTimeout(() => {
        if (activeRouteRequests.current === 0) {
          setIsRouteLoading(false);
          routeLoadingStartTime.current = null;
        }
      }, remainingTime);
    }
  }, []);

  return (
    <LoadingContext.Provider value={{
      isLoading,
      isRouteLoading,
      startLoading,
      stopLoading,
      startRouteLoading,
      stopRouteLoading
    }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
