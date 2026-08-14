import { useState, useEffect } from 'react';
import { useLocation } from '../hooks/useLocation';
import GoogleMapsAutocomplete from './GoogleMapsAutocomplete';

interface LocationPermissionRequestProps {
  onLocationGranted: () => void;
  skipable?: boolean;
  title?: string;
  description?: string;
  forceOpen?: boolean;
}

export default function LocationPermissionRequest({
  onLocationGranted,
  skipable = false,
  title = 'Location Access Required',
  description = 'We need your location to show you products available near you and enable delivery services.',
  forceOpen = false,
}: LocationPermissionRequestProps) {
  const { requestLocation, updateLocation, isLocationEnabled, isLocationLoading, locationError, locationPermissionStatus, clearLocation } = useLocation();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState(0);
  const [manualLng, setManualLng] = useState(0);
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [manualPincode, setManualPincode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-grant if already enabled or session permission exists (unless forced open)
  useEffect(() => {
    if (isLocationEnabled && !forceOpen) {
      console.log('[LocationPermissionRequest] Location is enabled, notifying parent.');
      onLocationGranted();
    }
  }, [isLocationEnabled, onLocationGranted, forceOpen]);

  const handleAllowLocation = async () => {
    // Clear any previous errors before retrying
    setManualAddress('');
    setManualLat(0);
    setManualLng(0);
    setShowManualInput(false);

    try {
      // ONLY call location API when user explicitly clicks the button
      // This ensures we don't auto-request location on app load
      await requestLocation();

      // If forced open (Change Location mode), we must manually close since the effect is disabled
      if (forceOpen) {
        onLocationGranted();
      }
    } catch (error) {
      // Error is handled by context and displayed in the error box
      // Location will remain disabled, modal will stay visible
      // User can retry or use manual location entry
    }
  };

  const handleManualLocationSelect = (address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string; pincode?: string }) => {
    setManualAddress(address);
    setManualLat(lat);
    setManualLng(lng);
    setManualCity(components?.city || '');
    setManualState(components?.state || '');
    setManualPincode(components?.pincode || '');
  };

  const handleSaveManualLocation = async () => {
    if (!manualAddress) {
      return;
    }

    setIsSaving(true);
    let lat = manualLat;
    let lng = manualLng;
    // Start with manual values, but prioritize fetched ones
    let finalAddress = manualAddress;
    let city = manualCity;
    let state = manualState;
    let pincode = manualPincode;

    // Track if we successfully resolved the address
    let isResolved = false;

    try {
      const geocoder = new window.google.maps.Geocoder();

      // Strategy 1: If we have coordinates, try valid REVERSE geocoding first
      if (lat && lng) {
        try {
          const result = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                resolve(results[0]);
              } else {
                reject(status);
              }
            });
          });

          if (result) {
            // we do NOT overwrite finalAddress here because we want to keep the name/address 
            // the user specifically selected from the autocomplete (e.g. "Indore" instead of "123 Street, Indore")

            // Check if we need to fill in missing components
            if (result.address_components) {
              // Only fill if empty to respect autocomplete data structure if it was present
              const hasCity = !!city;
              const hasState = !!state;
              const hasPincode = !!pincode;

              result.address_components.forEach((comp: any) => {
                if (!hasCity && comp.types.includes('locality')) city = comp.long_name;
                if (!hasState && comp.types.includes('administrative_area_level_1')) state = comp.long_name;
                if (!hasPincode && comp.types.includes('postal_code')) pincode = comp.long_name;
              });
            }
            isResolved = true;
          }
        } catch (error) {
          console.warn('Strategy 1 (Reverse Geocode) failed:', error);
          // If this fails (e.g. invalid coords), we continue to Strategy 2 (Text Geocode)
        }
      }

      // Strategy 2: If Strategy 1 failed or we didn't have coords, Geocode the TEXT
      if (!isResolved) {
        try {
          const result = await new Promise<any>((resolve, reject) => {
            // Constrain to India to match Autocomplete behavior and prevent weird matches
            geocoder.geocode({
              address: manualAddress,
              componentRestrictions: { country: 'in' }
            }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                resolve(results[0]);
              } else {
                reject(status);
              }
            });
          });

          if (result && result.geometry && result.geometry.location) {
            lat = result.geometry.location.lat();
            lng = result.geometry.location.lng();

            if (result.formatted_address) {
              finalAddress = result.formatted_address;
            }

            if (result.address_components) {
              city = ''; state = ''; pincode = '';
              result.address_components.forEach((comp: any) => {
                if (comp.types.includes('locality')) city = comp.long_name;
                if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
                if (comp.types.includes('postal_code')) pincode = comp.long_name;
              });
            }
            isResolved = true;
          }
        } catch (error) {
          console.error('Strategy 2 (Text Geocode) failed:', error);
        }
      }

      // Final Check: Do we have coordinates?
      if (!lat || !lng) {
        console.error("Could not resolve coordinates for address");
        setIsSaving(false);
        return;
      }

      console.log("Saving location:", { lat, lng, finalAddress, city, state });

      // Save manual location with the CORRECT full address and components
      await updateLocation({
        latitude: lat,
        longitude: lng,
        address: finalAddress,
        city: city,
        state: state,
        pincode: pincode
      });

      // Close modal
      onLocationGranted();
    } catch (error) {
      console.error('Failed to save manual location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLocationEnabled && !forceOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">{title}</h2>
          <p className="text-sm text-neutral-600">
            {description}
          </p>
        </div>

        {!showManualInput ? (
          <>
            {locationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 mb-2 font-medium">{locationError}</p>
                <p className="text-xs text-red-500">
                  {locationError.includes('timeout')
                    ? 'Please ensure your location/GPS is enabled and try again, or enter location manually.'
                    : 'You can try again or enter your location manually below.'}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleAllowLocation}
                disabled={isLocationLoading}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLocationLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Getting your location...</span>
                  </>
                ) : (
                  locationError ? 'Retry Location Access' : 'Allow Location Access'
                )}
              </button>

              <button
                onClick={() => setShowManualInput(true)}
                className="w-full py-3 bg-neutral-100 text-neutral-700 rounded-lg font-semibold hover:bg-neutral-200 transition-colors"
              >
                Enter Location Manually
              </button>

              {skipable && (
                <button
                  onClick={onLocationGranted}
                  className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Skip for now
                </button>
              )}

              {locationPermissionStatus === 'session_granted' && !isLocationEnabled && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <p className="text-xs text-neutral-500 mb-2">
                    Permission granted for this session, but location data is missing.
                  </p>
                  <button
                    onClick={clearLocation}
                    className="text-xs text-orange-600 font-medium hover:underline"
                  >
                    Reset and ask again
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Search and select your location
              </label>
              <GoogleMapsAutocomplete
                value={manualAddress}
                onChange={handleManualLocationSelect}
                placeholder="Type your address or location..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowManualInput(false)}
                className="flex-1 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-semibold hover:bg-neutral-200 transition-colors"
                disabled={isSaving}
              >
                Back
              </button>
              <button
                onClick={handleSaveManualLocation}
                disabled={!manualAddress || isSaving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Location'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
