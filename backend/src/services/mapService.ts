import axios from 'axios';
import { calculateDistance as haversineDistance } from '../utils/locationHelper';

interface LatLng {
    lat: number;
    lng: number;
}

/**
 * Get road distance (in km) between origin and destination using Google Routes API (computeRoutes).
 * Fallbacks to Google Directions API, and finally Haversine straight-line distance if API fails.
 */
export const getRoadDistance = async (
    origin: LatLng,
    destination: LatLng,
    apiKey?: string
): Promise<number> => {
    const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;

    // If no API key or invalid coordinates, fallback to Haversine
    if (!key || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        return haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    }

    // 1. Try Google Routes API (v2:computeRoutes)
    try {
        const routesResponse = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
                destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
                travelMode: 'DRIVE'
            },
            {
                headers: {
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
                },
                timeout: 8000
            }
        );

        if (routesResponse.data?.routes?.[0]?.distanceMeters !== undefined) {
            const distanceKm = routesResponse.data.routes[0].distanceMeters / 1000;
            return distanceKm;
        }
    } catch (routesErr: any) {
        // Fallback to Directions API if Routes API is not enabled yet
    }

    // 2. Fallback to Google Directions API (Classic)
    try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${key}`;
        const directionsResponse = await axios.get(url, { timeout: 8000 });

        if (directionsResponse.data?.status === 'OK' && directionsResponse.data.routes?.[0]?.legs?.[0]?.distance) {
            const distanceKm = directionsResponse.data.routes[0].legs[0].distance.value / 1000;
            return distanceKm;
        }
    } catch (directionsErr: any) {
        console.warn('[MapService] Directions API request failed:', directionsErr.message || directionsErr);
    }

    // 3. Ultimate Fallback: Haversine distance
    return haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
};

/**
 * Get matrix of road distances from multiple origins to one destination using Google Routes API (computeRouteMatrix).
 * Returns array of distances in km aligned with the input origins array.
 */
export const getRoadDistances = async (
    origins: LatLng[],
    destination: LatLng,
    apiKey?: string
): Promise<number[]> => {
    if (!origins.length) return [];

    const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;

    if (!key || !destination.lat || !destination.lng) {
        return origins.map(org => haversineDistance(org.lat, org.lng, destination.lat, destination.lng));
    }

    // 1. Try Google Routes API (v2:computeRouteMatrix)
    try {
        const matrixResponse = await axios.post(
            'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
            {
                origins: origins.map(o => ({
                    waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } }
                })),
                destinations: [{
                    waypoint: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } }
                }],
                travelMode: 'DRIVE'
            },
            {
                headers: {
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,status'
                },
                timeout: 8000
            }
        );

        if (Array.isArray(matrixResponse.data)) {
            const resultMap = new Map<number, number>();
            for (const item of matrixResponse.data) {
                if (item.originIndex !== undefined && item.distanceMeters !== undefined) {
                    resultMap.set(item.originIndex, item.distanceMeters / 1000);
                }
            }

            if (resultMap.size === origins.length) {
                return origins.map((_, idx) => resultMap.get(idx) ?? haversineDistance(origins[idx].lat, origins[idx].lng, destination.lat, destination.lng));
            }
        }
    } catch (matrixErr: any) {
        // Fallback to parallel Directions API or Haversine
    }

    // 2. Fallback: Query road distance per origin using getRoadDistance helper
    try {
        const distances = await Promise.all(
            origins.map(org => getRoadDistance(org, destination, key))
        );
        return distances;
    } catch (err) {
        return origins.map(org => haversineDistance(org.lat, org.lng, destination.lat, destination.lng));
    }
};
