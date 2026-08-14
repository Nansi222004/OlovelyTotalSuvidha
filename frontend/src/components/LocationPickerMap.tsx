import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

interface LocationPickerMapProps {
  initialLat: number;
  initialLng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: string;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629,
};

type Libraries = ("places" | "drawing" | "geometry" | "visualization")[];
const libraries: Libraries = ['places'];

export default function LocationPickerMap({
  initialLat,
  initialLng,
  onLocationSelect,
  height = "300px"
}: LocationPickerMapProps) {
  // Use the same ID and libraries as GoogleMapsAutocomplete to share the script
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(defaultCenter);

  // Update center when props change
  useEffect(() => {
    if (initialLat && initialLng) {
      setCenter({ lat: initialLat, lng: initialLng });
    }
  }, [initialLat, initialLng]);

  // Memoize options to prevent re-renders that could freeze the map
  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    draggable: true,
    gestureHandling: "greedy", // Ensures map handles gestures aggressively
  }), []);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const onIdle = useCallback(() => {
    if (map) {
      const newCenter = map.getCenter();
      if (newCenter) {
        const lat = parseFloat(newCenter.lat().toFixed(6));
        const lng = parseFloat(newCenter.lng().toFixed(6));
        onLocationSelect(lat, lng);
      }
    }
  }, [map, onLocationSelect]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div
        className="w-full bg-neutral-50 rounded-lg border border-neutral-200 flex flex-col items-center justify-center p-4 text-center"
        style={{ height }}
      >
        <span className="text-xl mb-1">📍</span>
        <p className="text-neutral-700 text-xs font-medium">Map preview is currently disabled.</p>
        <p className="text-neutral-500 text-[11px]">Location will be saved from your address inputs.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="w-full bg-neutral-100 animate-pulse rounded-lg border border-neutral-300"
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
          Loading Map...
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-neutral-300 shadow-sm" style={{ height }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={17}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={onIdle}
        options={mapOptions}
      >
        {/* We don't need a marker because we use a fixed center pin */}
      </GoogleMap>

      {/* Fixed Center Pin Overlay */}
      <div
        className="absolute top-1/2 left-1/2 z-10 pointer-events-none"
        style={{ transform: 'translate(-50%, -100%)' }}
      >
        <img
          src="https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png" // Google Maps standard red pin
          alt="Center Location"
          className="w-[27px] h-[43px]"
          style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))' }}
        />
      </div>
    </div>
  );
}
