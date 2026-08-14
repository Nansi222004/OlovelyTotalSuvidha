import { createContext } from 'react';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface LocationContextType {
  location: Location | null;
  isLocationEnabled: boolean;
  isLocationLoading: boolean;
  locationError: string | null;
  locationPermissionStatus: 'granted' | 'denied' | 'prompt' | 'session_granted';
  requestLocation: () => Promise<void>;
  updateLocation: (location: Location) => Promise<void>;
  clearLocation: () => void;
}

export const LocationContext = createContext<LocationContextType | undefined>(undefined);

