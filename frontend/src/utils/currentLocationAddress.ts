import { parseGoogleGeocodeResult } from './addressUtils';

export interface CurrentLocationAddress {
  latitude: number;
  longitude: number;
  /** Full readable address ('' when it could not be looked up — coordinates are still valid). */
  address: string;
  city: string;
  state: string;
  pincode: string;
}

/** Google Plus Codes like "33MC+R76, " at the start of an address are noise for people. */
const stripPlusCode = (s: string) => s.replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3},?\s*/i, '').trim();

function getGpsPosition(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Location is not supported on this device. Please type the address.'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: Number(p.coords.latitude.toFixed(6)),
        longitude: Number(p.coords.longitude.toFixed(6)),
      }),
      (err) => reject(new Error(
        err.code === 1
          ? 'Location permission denied. Allow location for this app in phone settings, then try again.'
          : 'Could not get your current location. Turn on GPS and try again.'
      )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function reverseGeocode(latitude: number, longitude: number): Promise<Omit<CurrentLocationAddress, 'latitude' | 'longitude'>> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length) {
        const parsed = parseGoogleGeocodeResult(data.results[0]);
        return {
          address: stripPlusCode(parsed.formattedAddress || data.results[0].formatted_address || ''),
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
        };
      }
    } catch {
      /* fall through to OpenStreetMap */
    }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`
    );
    if (res.ok) {
      const d = await res.json();
      const a = d.address || {};
      return {
        address: d.display_name || '',
        city: a.city || a.town || a.village || a.state_district || a.county || '',
        state: a.state || '',
        pincode: a.postcode ? String(a.postcode).replace(/\D/g, '').slice(0, 6) : '',
      };
    }
  } catch {
    /* address lookup failed; coordinates are still returned */
  }
  return { address: '', city: '', state: '', pincode: '' };
}

/**
 * GPS position of this device plus its readable address.
 * Rejects only when the position itself is unavailable (permission denied / GPS off).
 */
export async function getCurrentLocationAddress(): Promise<CurrentLocationAddress> {
  const { latitude, longitude } = await getGpsPosition();
  const resolved = await reverseGeocode(latitude, longitude);
  return { latitude, longitude, ...resolved };
}
