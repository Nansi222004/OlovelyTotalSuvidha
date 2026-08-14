import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { updateStatus, getDeliveryProfile, updateGeneralLocation, getSellersInRadius } from '../../../services/api/delivery/deliveryService';

interface SellerInRange {
  _id: string;
  storeName: string;
  address: string;
  serviceRadiusKm: number;
  distanceFromDeliveryBoy: number;
}

interface DeliveryStatusContextType {
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
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
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sellersInRangeCount, setSellersInRangeCount] = useState(0);
  const [sellersInRange, setSellersInRange] = useState<SellerInRange[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const profile = await getDeliveryProfile();
        setIsOnlineLocal(profile.isOnline || false);
      } catch (error) {
        console.error("Failed to fetch initial status", error);
      }
    };
    fetchStatus();
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

  const toggleStatus = async () => {
    const newStatus = !isOnline;
    // Optimistic update
    setIsOnlineLocal(newStatus);
    try {
      await updateStatus(newStatus);
    } catch (error) {
      console.error("Failed to update status", error);
      // Revert on failure
      setIsOnlineLocal(!newStatus);
    }
  };

  const setIsOnline = (status: boolean) => {
    // Direct setting if needed, but prefer toggleStatus for API sync
    setIsOnlineLocal(status);
    updateStatus(status).catch(err => console.error(err));
  };

  return (
    <DeliveryStatusContext.Provider value={{
      isOnline,
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
    throw new Error('useDeliveryStatus must be used within a DeliveryStatusProvider');
  }
  return context;
}

