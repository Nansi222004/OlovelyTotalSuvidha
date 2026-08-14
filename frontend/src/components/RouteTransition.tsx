import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteTransitionProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Smooth route transition wrapper that prevents flash of loading state
 * Only shows fallback if transition takes longer than 100ms
 */
export default function RouteTransition({ children, fallback }: RouteTransitionProps) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    setShowFallback(false);

    // Only show fallback if transition takes longer than 100ms
    const timeout = setTimeout(() => {
      setShowFallback(true);
    }, 100);

    // Reset transition state after a brief delay
    const resetTimeout = setTimeout(() => {
      setIsTransitioning(false);
      setShowFallback(false);
    }, 50);

    return () => {
      clearTimeout(timeout);
      clearTimeout(resetTimeout);
    };
  }, [location.pathname]);

  // Don't show fallback for fast transitions
  if (isTransitioning && showFallback && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

