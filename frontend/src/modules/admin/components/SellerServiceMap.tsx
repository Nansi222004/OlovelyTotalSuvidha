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
  iconAnchor: [15, 15]
});

interface SellerServiceMapProps {
  latitude: number;
  longitude: number;
  radiusKm: number;
  storeName: string;
}

export default function SellerServiceMap({
  latitude,
  longitude,
  radiusKm,
  storeName
}: SellerServiceMapProps) {
  // Center of the map
  const position: [number, number] = [latitude, longitude];
  
  // Radius in meters for Leaflet Circle
  const radiusMeters = radiusKm * 1000;

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer
        center={position}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={storeIcon}>
          <Popup>
            <div className="font-semibold">{storeName}</div>
            <div className="text-xs text-neutral-600">Service Radius: {radiusKm} km</div>
          </Popup>
        </Marker>
        <Circle
          center={position}
          radius={radiusMeters}
          pathOptions={{
            color: '#0D9488', // teal-600
            fillColor: '#0D9488',
            fillOpacity: 0.2,
            weight: 2
          }}
        />
      </MapContainer>
    </div>
  );
}
