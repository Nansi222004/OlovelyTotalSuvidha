import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext';

const useRouteLoader = () => {
  const location = useLocation();
  const { startRouteLoading, stopRouteLoading } = useLoading();
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Start loader on navigation
    // On initial mount, the LoadingProvider already started it (count=1)
    if (!isInitialMount.current) {
      startRouteLoading();
    }

    // Small delay to simulate route processing and ensure loader visibility
    const timer = setTimeout(() => {
      stopRouteLoading(); // This will decrement the count (to 0 on initial mount, or matching the startRouteLoading on navigation)
      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname, startRouteLoading, stopRouteLoading]);
};

export default useRouteLoader;
