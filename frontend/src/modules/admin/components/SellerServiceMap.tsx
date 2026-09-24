import React, { Component, ErrorInfo, ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom store icon
const storeIcon = new L.DivIcon({
  html: `<div style="font-size: 24px; text-align: center;">🏪</div>`,
  className: 'store-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

interface SellerServiceMapProps {
  latitude: number | string;
  longitude: number | string;
  radiusKm?: number | string;
  storeName?: string;
}

interface MapErrorBoundaryProps {
  children: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Leaflet Map Error caught by MapErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center p-4 text-center">
          <span className="text-2xl mb-2">🗺️</span>
          <p className="text-sm font-medium text-neutral-700">Unable to load map</p>
          <p className="text-xs text-neutral-400 mt-1">
            Please check coordinates or reload the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SellerServiceMap({
  latitude,
  longitude,
  radiusKm = 10,
  storeName = 'Store Location',
}: SellerServiceMapProps) {
  // Parse and strictly validate coordinates
  const lat = typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
  const lng = typeof longitude === 'number' ? longitude : parseFloat(String(longitude));
  const parsedRadius = typeof radiusKm === 'number' ? radiusKm : parseFloat(String(radiusKm));

  const isValidLat = !isNaN(lat) && isFinite(lat) && lat >= -90 && lat <= 90;
  const isValidLng = !isNaN(lng) && isFinite(lng) && lng >= -180 && lng <= 180;
  const isValidRadius = !isNaN(parsedRadius) && isFinite(parsedRadius) && parsedRadius > 0;

  if (!isValidLat || !isValidLng) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center p-4 text-center">
        <span className="text-2xl mb-2">📍</span>
        <p className="text-sm font-medium text-neutral-700">Coordinates Not Available or Invalid</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          Please enter valid Latitude (-90 to 90) and Longitude (-180 to 180) to visualize the service area map.
        </p>
      </div>
    );
  }

  // Valid center position
  const position: [number, number] = [lat, lng];

  // Radius in meters (fallback to 10km if radius input is invalid/empty)
  const safeRadiusKm = isValidRadius ? Math.min(Math.max(parsedRadius, 0.1), 300) : 10;
  const radiusMeters = safeRadiusKm * 1000;

  return (
    <MapErrorBoundary>
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 shadow-sm relative">
        <MapContainer
          key={`seller-map-${lat.toFixed(6)}-${lng.toFixed(6)}`}
          center={position}
          zoom={12}
          style={{ height: '100%', width: '100%', minHeight: '300px' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={storeIcon}>
            <Popup>
              <div className="font-semibold text-sm">{storeName}</div>
              <div className="text-xs text-neutral-600 mt-0.5">
                Service Radius: {safeRadiusKm} km ({Math.round(radiusMeters)} m)
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
          <Circle
            center={position}
            radius={radiusMeters}
            pathOptions={{
              color: '#0D9488', // teal-600
              fillColor: '#0D9488',
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        </MapContainer>
      </div>
    </MapErrorBoundary>
  );
}
