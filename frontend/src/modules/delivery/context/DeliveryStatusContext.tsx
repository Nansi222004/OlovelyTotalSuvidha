import { createContext, useCallback, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { updateStatus, getDeliveryProfile, updateGeneralLocation, getSellersInRadius } from '../../../services/api/delivery/deliveryService';
import { getAuthToken } from '../../../services/api/config';

interface SellerInRange {
  _id: string;
  storeName: string;
  address: string;
  serviceRadiusKm: number;
  distanceFromDeliveryBoy: number;
}

interface DeliveryStatusContextType {
  isOnline: boolean;
  isStatusLoading: boolean;
  isUpdatingStatus: boolean;
  setIsOnline: (status: boolean) => Promise<void>;
  toggleStatus: () => Promise<void>;
  currentLocation: { latitude: number; longitude: number } | null;
  sellersInRangeCount: number;
  sellersInRange: SellerInRange[];
  locationError: string | null;
  isLoadingSellers: boolean;
}

const DeliveryStatusContext = createContext<DeliveryStatusContextType | undefined>(undefined);

export function DeliveryStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnlineLocal] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sellersInRangeCount, setSellersInRangeCount] = useState(0);
  const [sellersInRange, setSellersInRange] = useState<SellerInRange[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const statusUpdateInFlightRef = useRef(false);

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (showLoading) setIsStatusLoading(true);
    try {
      const token = getAuthToken('delivery');
      if (!token) return;
      const profile = await getDeliveryProfile();
      setIsOnlineLocal(profile?.isOnline === true);
    } catch (error) {
      // Keep the last known state on transient profile/network failures. A failed
      // refresh must never be interpreted as an intentional Go Offline action.
      console.error("Failed to fetch delivery availability", error);
    } finally {
      if (showLoading) setIsStatusLoading(false);
    }
  }, []);

  // Restore the persisted backend state on app entry and when an iOS/PWA tab
  // returns to the foreground. Socket presence is intentionally not involved.
  useEffect(() => {
    void fetchStatus(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !statusUpdateInFlightRef.current) {
        void fetchStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchStatus]);

  // Cleanup location tracking and state on delivery logout
  useEffect(() => {
    const handleDeliveryLoggedOut = () => {
      setIsOnlineLocal(false);
      stopTracking();
      setCurrentLocation(null);
      setSellersInRange([]);
      setSellersInRangeCount(0);
      setLocationError(null);
    };

    window.addEventListener('olovely:delivery-logged-out', handleDeliveryLoggedOut);
    return () => {
      window.removeEventListener('olovely:delivery-logged-out', handleDeliveryLoggedOut);
    };
  }, []);

  // Location Tracking Logic
  useEffect(() => {
    if (isOnline) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [isOnline]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLocationError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 0, // Force fresh GPS data
        timeout: 15000,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleLocationUpdate = async (position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    setCurrentLocation({ latitude, longitude });

    // Battery optimization: only update backend every 30 seconds
    const now = Date.now();
    if (now - lastUpdateTimeRef.current > 30000) {
      lastUpdateTimeRef.current = now;
      try {
        // Update general location in backend
        await updateGeneralLocation(latitude, longitude);

        // Get sellers in radius
        setIsLoadingSellers(true);
        const data = await getSellersInRadius(latitude, longitude);
        setSellersInRangeCount(data.count || 0);
        setSellersInRange(data.sellers || []);
      } catch (error) {
        console.error("Failed to update location or fetch sellers in radius", error);
      } finally {
        setIsLoadingSellers(false);
      }
    }
  };

  const handleLocationError = (error: GeolocationPositionError) => {
    let message = "An unknown error occurred with location services";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = "Location permission denied. Please enable it in settings.";
        break;
      case error.POSITION_UNAVAILABLE:
        message = "Location information is unavailable.";
        break;
      case error.TIMEOUT:
        message = "The request to get user location timed out.";
        break;
    }
    setLocationError(message);
    console.error("Location error:", error);
  };

  const setIsOnline = async (status: boolean) => {
    if (isStatusLoading || statusUpdateInFlightRef.current || status === isOnline) return;

    statusUpdateInFlightRef.current = true;
    setIsUpdatingStatus(true);
    try {
      const response = await updateStatus(status);
      // The API response is authoritative; do not force the UI to the requested
      // value if the server persisted something different.
      setIsOnlineLocal(response?.data?.isOnline === true);
    } catch (error) {
      console.error("Failed to update status", error);
      await fetchStatus();
    } finally {
      statusUpdateInFlightRef.current = false;
      setIsUpdatingStatus(false);
    }
  };

  const toggleStatus = async () => {
    await setIsOnline(!isOnline);
  };

  return (
    <DeliveryStatusContext.Provider value={{
      isOnline,
      isStatusLoading,
      isUpdatingStatus,
      setIsOnline,
      toggleStatus,
      currentLocation,
      sellersInRangeCount,
      sellersInRange,
      locationError,
      isLoadingSellers
    }}>
      {children}
    </DeliveryStatusContext.Provider>
  );
}

export function useDeliveryStatus() {
  const context = useContext(DeliveryStatusContext);
  if (context === undefined) {
    return {
      isOnline: false,
      isStatusLoading: true,
      isUpdatingStatus: false,
      setIsOnline: async () => {},
      toggleStatus: async () => {},
      currentLocation: null,
      sellersInRangeCount: 0,
      sellersInRange: [],
      locationError: null,
      isLoadingSellers: false,
    };
  }
  return context;
}

