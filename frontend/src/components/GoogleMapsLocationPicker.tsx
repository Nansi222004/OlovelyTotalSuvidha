import { useCallback, useRef, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

interface GoogleMapsLocationPickerProps {
    initialLat: number;
    initialLng: number;
    onLocationSelect: (lat: number, lng: number, address?: { street?: string, city?: string, state?: string, pincode?: string, landmark?: string }) => void;
    height?: string;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};

export default function GoogleMapsLocationPicker({
    initialLat,
    initialLng,
    onLocationSelect,
    height = '200px'
}: GoogleMapsLocationPickerProps) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const mapRef = useRef<google.maps.Map | null>(null);
    const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
    const isDragging = useRef(false);

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey || ''
    });

    // Update center when initial props change significantly
    useEffect(() => {
        if (initialLat && initialLng) {
            const latDiff = Math.abs(center.lat - initialLat);
            const lngDiff = Math.abs(center.lng - initialLng);
            // Only update if change is significant (> 100m)
            if (latDiff > 0.001 || lngDiff > 0.001) {
                setCenter({ lat: initialLat, lng: initialLng });
                if (mapRef.current) {
                    mapRef.current.panTo({ lat: initialLat, lng: initialLng });
                }
            }
        }
    }, [initialLat, initialLng]);

    const onLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    const onUnmount = useCallback(() => {
        mapRef.current = null;
    }, []);

    const handleDragStart = useCallback(() => {
        isDragging.current = true;
    }, []);

    const handleDragEnd = useCallback(() => {
        isDragging.current = false;
        // Logic moved to handleIdle to prevent race conditions and double updates
    }, []);

    const handleIdle = useCallback(() => {
        // Capture location when map becomes idle (after drag or animation)
        if (!isDragging.current && mapRef.current) {
            const newCenter = mapRef.current.getCenter();
            if (newCenter) {
                const lat = parseFloat(newCenter.lat().toFixed(6));
                const lng = parseFloat(newCenter.lng().toFixed(6));

                // Only update if there's a real change (or if we need to fetch address)
                if (Math.abs(lat - center.lat) > 0.00001 || Math.abs(lng - center.lng) > 0.00001) {
                    setCenter({ lat, lng });

                    // Reverse Geocoding
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === 'OK' && results && results[0]) {
                            const addressComponents = results[0].address_components;
                            let street = '';
                            let city = '';
                            let state = '';
                            let pincode = '';
                            let landmark = '';

                            // Parse address components
                            addressComponents.forEach(component => {
                                const types = component.types;
                                if (types.includes('street_number')) {
                                    street = component.long_name + ' ' + street;
                                }
                                if (types.includes('route')) {
                                    street += component.long_name;
                                }
                                if (types.includes('locality')) {
                                    city = component.long_name;
                                }
                                if (types.includes('administrative_area_level_1')) {
                                    state = component.long_name;
                                }
                                if (types.includes('postal_code')) {
                                    pincode = component.long_name;
                                }
                                // Landmarks
                                if (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise')) {
                                    landmark = component.long_name;
                                } else if (!landmark && (types.includes('sublocality') || types.includes('sublocality_level_1'))) {
                                    landmark = component.long_name;
                                }
                            });

                            onLocationSelect(lat, lng, {
                                street: street.trim(),
                                city,
                                state,
                                pincode,
                                landmark
                            });
                        } else {
                            onLocationSelect(lat, lng);
                        }
                    });
                }
            }
        }
    }, [center.lat, center.lng, onLocationSelect]);

    if (loadError) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center" style={{ height }}>
                <p className="text-red-800 text-sm">❌ Failed to load Google Maps</p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="bg-gray-100 rounded-lg p-4 text-center flex items-center justify-center" style={{ height }}>
                <div className="flex flex-col items-center">
                    <div className="animate-spin text-2xl mb-2">🗺️</div>
                    <p className="text-gray-600 text-sm">Loading map...</p>
                </div>
            </div>
        );
    }

    if (!apiKey) {
        return (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center flex flex-col items-center justify-center gap-2" style={{ height }}>
                <span className="text-xl">📍</span>
                <p className="text-neutral-700 text-xs font-medium">Map preview is currently disabled.</p>
                <p className="text-neutral-500 text-[11px]">Please enter your address details in the form fields below.</p>
            </div>
        );
    }

    return (
        <div className="relative rounded-lg overflow-hidden border border-neutral-300 shadow-sm" style={{ height }}>
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={17}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onIdle={handleIdle}
                options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    gestureHandling: 'greedy',
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'off' }]
                        }
                    ]
                }}
            />

            {/* Fixed Center Pin Overlay */}
            <div
                className="absolute top-1/2 left-1/2 z-10 pointer-events-none"
                style={{ transform: 'translate(-50%, -91.6%)' }} /* Align point (12, 22) of 24x24 grid at center */
            >
                <div className="flex flex-col items-center">
                    {/* Tiny target dot at exact center for reference */}
                    <div className="w-1 h-1 bg-black/40 rounded-full absolute top-[91.6%] left-1/2 -translate-x-1/2 -translate-y-1/2" />

                    {/* Pin icon */}
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="drop-shadow-lg"
                    >
                        <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                            fill="#EF4444"
                            stroke="#B91C1C"
                            strokeWidth="1"
                        />
                        <circle cx="12" cy="9" r="2.5" fill="white" />
                    </svg>
                    {/* Shadow dot */}
                    <div
                        className="w-3 h-1 bg-black/20 rounded-full mt-1"
                        style={{ filter: 'blur(1px)' }}
                    />
                </div>
            </div>

            {/* Locate Me Button */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    if (!navigator.geolocation) return;

                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = '<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';

                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const { latitude, longitude } = position.coords;
                            const newPos = { lat: latitude, lng: longitude };

                            // Let onIdle handle state sync and geocoding by only panning the map
                            if (mapRef.current) {
                                mapRef.current.panTo(newPos);
                                mapRef.current.setZoom(18);
                            }
                            btn.disabled = false;
                            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
                        },
                        (error) => {
                            console.error('Error getting location:', error);
                            btn.disabled = false;
                            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                    );
                }}
                className="absolute right-3 top-3 z-20 bg-white p-2.5 rounded-full shadow-md hover:bg-neutral-50 active:scale-95 transition-all border border-neutral-200 text-blue-600 flex items-center justify-center group"
                title="Use current location"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
            </button>

            {/* Instruction overlay */}
            <div className="absolute bottom-2 left-2 right-2 z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-sm">
                    <p className="text-xs text-neutral-700 font-medium">
                        📍 Move the map to set your exact delivery location
                    </p>
                </div>
            </div>
        </div>
    );
}
