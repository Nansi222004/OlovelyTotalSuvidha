import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api/config';
import { LocationContext, Location } from './locationContext.types';

// Geocoding result interface
interface GeocodeResult {
  formatted_address: string;
  city?: string;
  state?: string;
  pincode?: string;
}

// Cache for geocoding results to avoid redundant API calls
const geocodeCache = new Map<string, { data: GeocodeResult; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Generate cache key from coordinates
const getCacheKey = (lat: number, lng: number, precision: number = 4): string => {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
};

// Clean address by removing Plus Codes and unwanted identifiers
const cleanAddress = (address: string): string => {
  if (!address) return address;


  // Remove Plus Codes more comprehensively:
  // 1. Match Plus Code at start (with optional trailing delimiters)
  // 2. Match Plus Code at end (with optional leading delimiters)
  // 3. Match Plus Code in middle (with surrounding delimiters)
  // 4. Match standalone Plus Code (with optional surrounding spaces)


  const cleaned = address
    // Remove Plus Code at start (with or without trailing delimiters)
    .replace(/^[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}([,\s]+)?/i, '')
    // Remove Plus Code at end (with or without leading delimiters)
    .replace(/([,\s]+)?[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}$/i, '')
    // Remove Plus Code in middle (with surrounding delimiters - most common case)
    .replace(/([,\s]+)[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}([,\s]+)/gi, (_match, before, after) => {
      // Preserve one delimiter (prefer comma if available)
      return before.includes(',') || after.includes(',') ? ', ' : ' ';
    })
    // Remove standalone Plus Code with spaces (fallback for any remaining)
    .replace(/\s+[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}\s+/gi, ' ')
    // Remove any remaining Plus Codes that might be attached to words (no spaces)
    .replace(/\b[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}\b/gi, '')
    // Clean up multiple commas/spaces
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '') // Remove leading/trailing commas and spaces
    .trim();


  return cleaned;
};

export function LocationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'session_granted'>('prompt');

  // Constants for storage
  const SESSION_PERMISSION_KEY = 'location_permission_granted_session';
  const LOCATION_STORAGE_KEY = 'userLocation';

  // Refs for request cancellation and preventing race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestingRef = useRef(false);

  // Initialize location state and check session permission
  useEffect(() => {
    const checkInitialPermission = async () => {
      console.log('[LocationContext] Checking initial permission status...');

      try {
        // 1. Check sessionStorage for session-level permission
        const sessionGranted = sessionStorage.getItem(SESSION_PERMISSION_KEY);

        if (sessionGranted === 'true') {
          console.log('[LocationContext] Permission already granted in this session.');

          // 2. Check for cached location in localStorage
          const cachedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
          if (cachedLocation) {
            try {
              const parsedLocation = JSON.parse(cachedLocation);
              console.log('[LocationContext] Using cached location from this session:', parsedLocation.address);
              setLocation(parsedLocation);
              setIsLocationEnabled(true);
              setLocationPermissionStatus('session_granted');
            } catch (e) {
              console.error('[LocationContext] Failed to parse cached location:', e);
            }
          } else {
            // Permission granted but no location? Prompt to refresh it
            console.log('[LocationContext] Session permission exists but no cached location.');
            setLocationPermissionStatus('session_granted');
          }
        } else {
          console.log('[LocationContext] No session-level permission found. User will be prompted.');
          setLocation(null);
          setIsLocationEnabled(false);
          setLocationPermissionStatus('prompt');
        }
      } catch (error) {
        console.error('[LocationContext] Error checking session storage:', error);
        // Fallback to prompt if storage is unavailable
        setLocationPermissionStatus('prompt');
      } finally {
        setIsLocationLoading(false);
      }
    };

    checkInitialPermission();
  }, []);

  // Request user's current location - OPTIMIZED for speed and accuracy
  const requestLocation = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      console.error('[LocationContext] Geolocation is not supported');
      setLocationError('Geolocation is not supported by your browser');
      setIsLocationLoading(false);
      return;
    }

    // Prevent concurrent requests
    if (isRequestingRef.current) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any cached geocode results to ensure fresh reverse geocoding
    geocodeCache.clear();

    isRequestingRef.current = true;
    setIsLocationLoading(true);
    setLocationError(null);
    abortControllerRef.current = new AbortController();

    console.log('[LocationContext] Requesting geolocation from browser...');

    return new Promise((resolve, reject) => {
      // Optimized geolocation options - force fresh, high-accuracy location
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('[LocationContext] Geolocation granted by browser.');

          // 1. Mark permission as granted in this session
          try {
            sessionStorage.setItem(SESSION_PERMISSION_KEY, 'true');
            setLocationPermissionStatus('session_granted');
            console.log('[LocationContext] Permission status stored in sessionStorage.');
          } catch (e) {
            console.warn('[LocationContext] Failed to save to sessionStorage:', e);
          }

          // Check if request was cancelled
          if (abortControllerRef.current?.signal.aborted) {
            isRequestingRef.current = false;
            return;
          }

          try {
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`[LocationContext] Received coords: ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);

            // Validate coordinates
            if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
              throw new Error('Invalid coordinates received');
            }

            // Validate coordinate ranges (sanity check)
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
              throw new Error('Coordinates out of valid range');
            }

            // Check accuracy (warn if accuracy is poor but don't fail)
            if (accuracy > 1000) {
              console.warn(`Location accuracy is ${accuracy}m - may not be precise`);
            }

            // Set coordinates immediately for instant UI update
            const tempLocation: Location = {
              latitude,
              longitude,
              address: `Getting address for ${latitude.toFixed(6)}, ${longitude.toFixed(6)}...`, // More descriptive temporary
              city: undefined,
              state: undefined,
              pincode: undefined,
            };
            setLocation(tempLocation);
            setIsLocationEnabled(true);
            setIsLocationLoading(false); // Set loading false early
            setLocationError(null); // Clear any previous errors since location was successfully obtained

            // Reverse geocode in background (non-blocking)
            // IMPORTANT: Use the exact coordinates received, skip cache to ensure fresh geocoding
            try {
              const address = await reverseGeocode(latitude, longitude, abortControllerRef.current?.signal, true); // skipCache = true


              // Check if request was cancelled during geocoding
              if (abortControllerRef.current?.signal.aborted) {
                isRequestingRef.current = false;
                return;
              }

              // Address is already cleaned from reverseGeocode function
              const cleanedAddress = address.formatted_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

              const newLocation: Location = {
                latitude,
                longitude,
                address: cleanedAddress,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
              };

              setLocation(newLocation);
              setLocationError(null); // Clear error on successful geocoding
              localStorage.setItem('userLocation', JSON.stringify(newLocation));

              // Save to backend in background (non-blocking, don't wait - only for customers)

              // Save to backend in background (non-blocking, don't wait)
              if (isAuthenticated && user && user.userType === 'Customer') {
                saveLocationToBackend(newLocation).catch(err => {
                  console.error('Background location save failed:', err);
                  // Don't fail the request - location is already saved locally
                });
              }

              isRequestingRef.current = false;
              resolve();
            } catch (error: unknown) {
              // First try to recover if it was just a geocoding error
              const geocodeError = error;
              if (latitude && longitude) {
                // Geocoding failed but we have coordinates - still success
                console.warn('Geocoding failed, using coordinates:', geocodeError);
                const fallbackLocation: Location = {
                  latitude,
                  longitude,
                  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                };
                setLocation(fallbackLocation);
                setLocationError(null); // Clear error since we have valid coordinates
                localStorage.setItem('userLocation', JSON.stringify(fallbackLocation));

                // Try to save to backend anyway
                if (isAuthenticated && user && user.userType === 'Customer') {
                  saveLocationToBackend(fallbackLocation).catch(() => { });
                }

                isRequestingRef.current = false;
                resolve(); // Still resolve - we have coordinates
                return;
              }

              // Real error - fail
              if (!abortControllerRef.current?.signal.aborted) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to get location address';
                setLocationError(errorMessage);
              }
              setIsLocationLoading(false);
              isRequestingRef.current = false;
              reject(error);
            }
          } catch (error: unknown) {
            console.error('Error in location success callback:', error);
            if (!abortControllerRef.current?.signal.aborted) {
              setLocationError('Failed to process location data');
            }
            setIsLocationLoading(false);
            isRequestingRef.current = false;
            reject(error);
          }
        },
        (error: GeolocationPositionError) => {
          if (abortControllerRef.current?.signal.aborted) {
            isRequestingRef.current = false;
            return;
          }

          let errorMessage = 'Failed to get your location';
          console.error(`[LocationContext] Geolocation error (${error.code}): ${error.message}`);

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission was denied. Please enable it in your browser settings to use this feature.';
              setLocationPermissionStatus('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your device location settings.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please ensure GPS/location is enabled and try again, or enter location manually.';
              break;
            default:
              errorMessage = 'Unable to get your location. Please try again or enter location manually.';
          }
          setLocationError(errorMessage);
          setIsLocationLoading(false);
          isRequestingRef.current = false;
          reject(new Error(errorMessage));
        },
        geoOptions
      );
    });
  }, [isAuthenticated, user, SESSION_PERMISSION_KEY, LOCATION_STORAGE_KEY]);

  // Helper function to save location to backend (non-blocking)
  const saveLocationToBackend = async (locationData: Location): Promise<void> => {
    await api.post('/customer/location', {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      address: locationData.address,
      city: locationData.city,
      state: locationData.state,
      pincode: locationData.pincode,
    });
  };

  // Reverse geocode coordinates to address - OPTIMIZED with caching and retry logic
  const reverseGeocode = async (lat: number, lng: number, signal?: AbortSignal, skipCache: boolean = false): Promise<GeocodeResult> => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // Google Maps API disabled/commented out - use free OpenStreetMap Nominatim fallback
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
          { signal }
        );
        if (response.ok) {
          const data = await response.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
          const state = addr.state || '';
          const pincode = addr.postcode || '';
          return {
            formatted_address: data.display_name ? cleanAddress(data.display_name) : `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            city,
            state,
            pincode,
          };
        }
      } catch (e) {
        console.warn('Reverse geocode fallback:', e);
      }
      return { formatted_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }

    // Validate input coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.error('❌ Invalid coordinates for geocoding:', lat, lng);
      return { formatted_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }

    // Generate cache key (needed for both cache lookup and storage)
    const cacheKey = getCacheKey(lat, lng);

    // Skip cache for fresh location requests (when skipCache is true)
    // This ensures we always get the correct address for current coordinates
    if (!skipCache) {
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }

    // Retry logic for robustness
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check if request was cancelled
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      try {
        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        // Use precise coordinates (6 decimal places = ~10cm accuracy)
        const preciseLat = lat.toFixed(6);
        const preciseLng = lng.toFixed(6);

        // Use more precise result types and location_type to get better address match
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${preciseLat},${preciseLng}&key=${apiKey}&result_type=street_address|premise|route|sublocality|locality|administrative_area_level_1|postal_code&location_type=ROOFTOP|RANGE_INTERPOLATED&language=en`;

        const response = await fetch(geocodeUrl, {
          signal: signal || controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle API errors
        if (data.status === 'ZERO_RESULTS') {
          return { formatted_address: `${lat}, ${lng}` };
        }

        if (data.status !== 'OK') {
          throw new Error(`Geocoding API error: ${data.status}`);
        }

        if (data.results.length === 0) {
          return { formatted_address: `${lat}, ${lng}` };
        }

        // Find the result that best matches the input coordinates
        // Filter results and find the one closest to input coordinates
        let bestResult = data.results[0];
        let minDistance = Infinity;

        for (const result of data.results) {
          const resultLocation = result.geometry?.location;
          if (resultLocation) {
            const latDiff = Math.abs(resultLocation.lat - lat);
            const lngDiff = Math.abs(resultLocation.lng - lng);
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

            if (distance < minDistance) {
              minDistance = distance;
              bestResult = result;
            }
          }
        }

        const result = bestResult;
        const addressComponents = result.address_components || [];

        // Verify the geocoded location matches input coordinates
        const geocodedLocation = result.geometry?.location;
        if (geocodedLocation) {
          const latDiff = Math.abs(geocodedLocation.lat - lat);
          const lngDiff = Math.abs(geocodedLocation.lng - lng);
          const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;

          // Warn if geocoded location is more than 100m away
          if (distanceMeters > 100) {
            console.warn('Geocoded location differs from input:', {
              input: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              geocoded: `${geocodedLocation.lat.toFixed(6)}, ${geocodedLocation.lng.toFixed(6)}`,
              distance: `${distanceMeters.toFixed(0)}m`
            });
          }
        }

        let city = '';
        let state = '';
        let pincode = '';

        // Improved address component parsing - prioritize more specific types
        addressComponents.forEach((component: { types?: string[]; long_name?: string; short_name?: string }) => {
          const types = component.types || [];
          // City: prefer locality, then sublocality, then administrative_area_level_2
          if (!city) {
            if (types.includes('locality')) {
              city = component.long_name || '';
            } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              city = component.long_name || city;
            } else if (types.includes('administrative_area_level_2') && !city) {
              city = component.long_name || city;
            }
          }
          // State: administrative_area_level_1
          if (!state && types.includes('administrative_area_level_1')) {
            state = component.long_name || '';
          }
          // Pincode: postal_code
          if (!pincode && types.includes('postal_code')) {
            pincode = component.long_name || '';
          }
        });

        // Clean the formatted address to remove Plus Codes
        const rawAddress = result.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const cleanedAddress = cleanAddress(rawAddress);

        const geocodeResult = {
          formatted_address: cleanedAddress,
          city,
          state,
          pincode,
        };

        // Cache the result
        geocodeCache.set(cacheKey, {
          data: geocodeResult,
          timestamp: Date.now(),
        });

        // Limit cache size (keep last 100 entries)
        if (geocodeCache.size > 100) {
          const firstKey = geocodeCache.keys().next().value;
          if (firstKey) {
            geocodeCache.delete(firstKey);
          }
        }

        return geocodeResult;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;


        // Don't retry on abort
        if (signal?.aborted || err.name === 'AbortError') {
          throw err;
        }

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          // Exponential backoff: wait 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
          continue;
        }
      }
    }

    // All retries failed
    console.error('Reverse geocoding failed after retries:', lastError);
    return { formatted_address: `${lat}, ${lng}` };
  };

  // Update location manually - OPTIMIZED for instant UI update
  const updateLocation = useCallback(async (newLocation: Location): Promise<void> => {
    console.log('[LocationContext] Updating location manually:', newLocation.address);

    // Validate location data
    if (!newLocation.latitude || !newLocation.longitude ||
      isNaN(newLocation.latitude) || isNaN(newLocation.longitude)) {

      throw new Error('Invalid location coordinates');
    }

    // 1. Mark permission as granted in this session (manual selection counts as consent)
    try {
      sessionStorage.setItem(SESSION_PERMISSION_KEY, 'true');
      setLocationPermissionStatus('session_granted');
    } catch (e) {
      console.warn('[LocationContext] Failed to save to sessionStorage:', e);
    }

    // Update UI immediately (instant feedback)
    setLocation(newLocation);
    setIsLocationEnabled(true);
    setLocationError(null);
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));

    // Cache geocoding result if we have full address
    if (newLocation.address && newLocation.latitude && newLocation.longitude) {
      const cacheKey = getCacheKey(newLocation.latitude, newLocation.longitude);
      geocodeCache.set(cacheKey, {
        data: {
          formatted_address: newLocation.address,
          city: newLocation.city,
          state: newLocation.state,
          pincode: newLocation.pincode,
        },
        timestamp: Date.now(),
      });
    }

    // Save to backend in background (non-blocking)
    if (isAuthenticated && user && user.userType === 'Customer') {
      saveLocationToBackend(newLocation).catch(err => {
        console.error('[LocationContext] Background location save failed:', err);
      });
    }
  }, [isAuthenticated, user, SESSION_PERMISSION_KEY, LOCATION_STORAGE_KEY]);

  // Clear location
  const clearLocation = useCallback(() => {
    console.log('[LocationContext] Clearing location and session permission.');
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isRequestingRef.current = false;

    setLocation(null);
    setIsLocationEnabled(false);
    setLocationPermissionStatus('prompt');
    localStorage.removeItem(LOCATION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_PERMISSION_KEY);
  }, [SESSION_PERMISSION_KEY, LOCATION_STORAGE_KEY]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        isLocationEnabled,
        isLocationLoading,
        locationError,
        locationPermissionStatus,
        requestLocation,
        updateLocation,
        clearLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

// Hook moved to hooks/useLocation.ts to fix Fast Refresh warning





