import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrderAddress } from '../../types/order';
import { getAddresses, addAddress, updateAddress, Address } from '../../services/api/customerAddressService';
import { getProfile } from '../../services/api/customerService';
import GoogleMapsLocationPicker from '../../components/GoogleMapsLocationPicker';
import { parseGoogleGeocodeResult } from '../../utils/addressUtils';

export default function CheckoutAddress() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation state params
  const stateData = (location.state as any) || {};
  const editAddress = stateData.editAddress as OrderAddress | undefined;
  const initialLocation = stateData.initialLocation as {
    latitude?: number;
    longitude?: number;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  } | undefined;
  const returnTo = stateData.returnTo || '/checkout';

  // Form state
  const [formData, setFormData] = useState({
    name: editAddress?.name || '',
    phone: editAddress?.phone || '',
    flat: editAddress?.flat || '',
    street: editAddress?.street || initialLocation?.street || '',
    landmark: editAddress?.landmark || initialLocation?.landmark || '',
    city: editAddress?.city || initialLocation?.city || '',
    state: editAddress?.state || initialLocation?.state || '',
    pincode: editAddress?.pincode || initialLocation?.pincode || '',
  });

  const [addressType, setAddressType] = useState<'Home' | 'Work' | 'Hotel' | 'Other'>('Home');
  const [isDefault, setIsDefault] = useState<boolean>(true);

  // Map and coordinates state (Single atomic location source)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: editAddress?.latitude || initialLocation?.latitude || 0,
    lng: editAddress?.longitude || initialLocation?.longitude || 0,
  });
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string>('');
  const [showMap, setShowMap] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingStatus, setLocatingStatus] = useState<'' | 'detecting' | 'geocoding'>('');
  const [isAddressModifiedAfterPin, setIsAddressModifiedAfterPin] = useState(false);
  const latestLocationRequestId = useRef(0);
  const [isSaving, setIsSaving] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Helper to extract clean 10-digit Indian phone number
  const extractPhone = (raw: any): string => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  // Prefill phone and name from auth context / profile
  useEffect(() => {
    // If editing existing address, preserve its values
    if (editAddress) {
      if ((editAddress as any).type) {
        const t = (editAddress as any).type;
        const normalizedType = (t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()) as any;
        if (['Home', 'Work', 'Hotel', 'Other'].includes(normalizedType)) {
          setAddressType(normalizedType);
        }
      }
      return;
    }

    // Prefill phone
    const userPhone = extractPhone(user?.phone || user?.mobile);
    if (userPhone && userPhone.length === 10) {
      setFormData(prev => ({
        ...prev,
        phone: prev.phone ? prev.phone : userPhone,
      }));
      // Fallback: fetch profile to get registered phone and name
      getProfile().then(res => {
        if (res.success && res.data) {
          const profilePhone = res.data.phone ? extractPhone(res.data.phone) : '';
          const profileName = (res.data.name || '').trim();
          setFormData(prev => ({
            ...prev,
            ...(profilePhone.length === 10 && !prev.phone ? { phone: profilePhone } : {}),
            ...(profileName && profileName !== 'User' && !prev.name ? { name: profileName } : {}),
          }));
        }
      }).catch(() => {
        // Non-blocking fallback
      });
    }

    // Prefill name if available and not placeholder
    const userName = (user?.name || '').trim();
    if (userName && userName !== 'User') {
      setFormData(prev => ({
        ...prev,
        name: prev.name ? prev.name : userName,
      }));
    }
  }, [user, isAuthenticated, editAddress]);

  // If initial coords are 0 and browser supports geolocation, get default coords for map display
  useEffect(() => {
    if (coords.lat === 0 && coords.lng === 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Default fallback (e.g. New Delhi / central India coordinates)
          setCoords({ lat: 28.6139, lng: 77.2090 });
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Validation function
  const validateField = (field: string, value: string): string => {
    const val = (value || '').trim();
    switch (field) {
      case 'name':
        if (!val) return 'Full name is required';
        if (val.length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'phone': {
        const cleanDigits = val.replace(/\D/g, '');
        if (!cleanDigits) return 'Mobile number is required';
        if (cleanDigits.length !== 10) return 'Please enter a valid 10-digit mobile number';
        if (!/^[6-9]\d{9}$/.test(cleanDigits)) return 'Mobile number must start with 6, 7, 8, or 9';
        return '';
      }
      case 'flat':
        if (!val) return 'Flat / House / Building number is required';
        return '';
      case 'street':
        if (!val) return 'Street / Area is required';
        return '';
      case 'city':
        if (!val) return 'City is required';
        return '';
      case 'state':
        if (!val) return 'State is required';
        return '';
      case 'pincode': {
        const cleanPin = val.replace(/\D/g, '');
        if (!cleanPin) return 'Pincode is required';
        if (cleanPin.length !== 6) return 'Pincode must be 6 digits';
        return '';
      }
      default:
        return '';
    }
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fields = ['name', 'phone', 'flat', 'street', 'city', 'state', 'pincode'];
    
    fields.forEach((f) => {
      const err = validateField(f, (formData as any)[f]);
      if (err) newErrors[f] = err;
    });

    setErrors(newErrors);
    // Mark all as touched
    const allTouched: Record<string, boolean> = {};
    fields.forEach(f => { allTouched[f] = true; });
    setTouched(allTouched);

    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: err }));
    }
    // If user changes city, pincode, or street manually after GPS coordinates were set, mark modified
    if (['city', 'pincode', 'street'].includes(field) && (coords.lat !== 0 || coords.lng !== 0)) {
      setIsAddressModifiedAfterPin(true);
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, (formData as any)[field]);
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  // "Use Current Location" handler - Atomic location retrieval and reverse geocoding
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    const currentReqId = ++latestLocationRequestId.current;
    setIsLocating(true);
    setLocatingStatus('detecting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Discard stale out-of-order geolocation responses
        if (currentReqId !== latestLocationRequestId.current) return;

        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        const acc = position.coords.accuracy;
        const timestamp = position.timestamp || Date.now();

        // Safe dev logging (Section 2)
        if (process.env.NODE_ENV !== 'production') {
          console.log('[ADDRESS_SYNC_DEBUG] 1. GPS Position:', {
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            timestamp,
          });
        }

        // Store exact coordinates atomically
        setCoords({ lat, lng });
        setAccuracy(acc);
        setLocatingStatus('geocoding');

        // Reverse geocode via Google Geocoder if available
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            // Drop response if a newer location request was dispatched
            if (currentReqId !== latestLocationRequestId.current) return;

            setIsLocating(false);
            setLocatingStatus('');

            if (status === 'OK' && results && results[0]) {
              const parsed = parseGoogleGeocodeResult(results[0]);

              if (process.env.NODE_ENV !== 'production') {
                console.log('[ADDRESS_SYNC_DEBUG] 2. Reverse Geocode:', {
                  latitude: lat,
                  longitude: lng,
                  formattedAddress: parsed.formattedAddress,
                  placeId: parsed.placeId,
                  addressComponents: parsed,
                });
              }

              setPlaceId(parsed.placeId || '');
              setIsAddressModifiedAfterPin(false);

              // Atomically update address form fields strictly from the reverse geocoding result
              // Do NOT retain stale city, state, or pincode from a previous address
              setFormData(prev => ({
                ...prev,
                // Keep previously typed house/flat number if present, otherwise prompt user to enter it
                flat: prev.flat || '',
                street: parsed.street,
                city: parsed.city,
                state: parsed.state,
                pincode: parsed.pincode,
                landmark: parsed.landmark || '',
              }));

              const accMsg = acc <= 100
                ? 'Location detected! Please enter your flat/house number.'
                : `Location detected (±${Math.round(acc)}m). Please adjust pin or verify details.`;
              showToast(accMsg, 'success');
            } else {
              setIsAddressModifiedAfterPin(false);
              showToast('GPS coordinates set! Please enter your street and house details.', 'info');
            }
          });
        } else {
          setIsLocating(false);
          setLocatingStatus('');
          setIsAddressModifiedAfterPin(false);
          showToast('GPS coordinates set. Please complete your address details.', 'info');
        }
      },
      (error) => {
        if (currentReqId !== latestLocationRequestId.current) return;

        setIsLocating(false);
        setLocatingStatus('');
        let errorMsg = 'Could not retrieve your location. You can enter your address manually.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please enter your address manually below.';
        }
        showToast(errorMsg, 'info');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Map pin drag handler - Synchronizes marker coords, address fields, and database state
  const handleMapLocationSelect = useCallback(
    (lat: number, lng: number, addrData?: any) => {
      setCoords({ lat, lng });
      setIsAddressModifiedAfterPin(false);

      if (addrData) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[ADDRESS_SYNC_DEBUG] Map Pin Selected:', { lat, lng, addrData });
        }
        setFormData(prev => ({
          ...prev,
          street: addrData.street || addrData.formattedAddress || prev.street,
          city: addrData.city || prev.city,
          state: addrData.state || prev.state,
          pincode: addrData.pincode || prev.pincode,
          landmark: addrData.landmark || prev.landmark,
        }));
        if (addrData.placeId) {
          setPlaceId(addrData.placeId);
        }
      }
    },
    []
  );

  // Save Address submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAll()) {
      showToast('Please correct the highlighted fields before saving.', 'error');
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0] || 'flat';
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.focus();
      return;
    }

    setIsSaving(true);

    try {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      const cleanPincode = formData.pincode.replace(/\D/g, '');
      const fullAddress = `${formData.flat.trim()}, ${formData.street.trim()}`;

      let finalLat: number | null = (coords.lat && coords.lat !== 0) ? coords.lat : null;
      let finalLng: number | null = (coords.lng && coords.lng !== 0) ? coords.lng : null;

      // Flow B / Manual address adjustment: If user modified address text significantly after GPS fix,
      // re-geocode the entered address to align coordinates with the delivery text
      if (isAddressModifiedAfterPin && window.google?.maps?.Geocoder) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const query = `${formData.street}, ${formData.city}, ${formData.state} ${cleanPincode}`.trim();
          const geoRes = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
            geocoder.geocode({ address: query }, (results, status) => {
              if (status === 'OK' && results && results[0]) resolve(results);
              else resolve(null);
            });
          });
          if (geoRes && geoRes[0]?.geometry?.location) {
            finalLat = parseFloat(geoRes[0].geometry.location.lat().toFixed(6));
            finalLng = parseFloat(geoRes[0].geometry.location.lng().toFixed(6));
          }
        } catch (e) {
          console.warn('Geocoding updated address failed, keeping existing coordinates', e);
        }
      }

      // Safe dev logging (Section 2)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ADDRESS_SYNC_DEBUG] 3. Form State Before Save:', {
          fullName: formData.name.trim(),
          address: fullAddress,
          flatHouseNo: formData.flat.trim(),
          streetArea: formData.street.trim(),
          landmark: formData.landmark.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: cleanPincode,
          latitude: finalLat,
          longitude: finalLng,
          accuracy,
          placeId,
        });
      }

      const payload: any = {
        fullName: formData.name.trim(),
        name: formData.name.trim(),
        phone: cleanPhone,
        flat: formData.flat.trim(),
        street: formData.street.trim(),
        address: fullAddress,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: cleanPincode,
        landmark: formData.landmark.trim(),
        type: addressType,
        isDefault,
        latitude: finalLat !== null ? finalLat : undefined,
        longitude: finalLng !== null ? finalLng : undefined,
      };

      if (process.env.NODE_ENV !== 'production') {
        console.log('[ADDRESS_SYNC_DEBUG] 4. API Payload Sent:', payload);
      }

      let savedId: string | undefined;
      let customerProfileName: string | undefined;

      if (editAddress && (editAddress.id || editAddress._id)) {
        const addressId = editAddress.id || editAddress._id!;
        const res = await updateAddress(addressId, payload);
        savedId = (res.data as any)?._id || (res.data as any)?.id || addressId;
        customerProfileName = res.customerProfileName || (res.data as any)?.customerProfileName;
        showToast('Delivery address updated successfully!', 'success');
      } else {
        const res = await addAddress(payload);
        savedId = (res.data as any)?._id || (res.data as any)?.id;
        customerProfileName = res.customerProfileName || (res.data as any)?.customerProfileName;
        showToast('Delivery address saved successfully!', 'success');
      }

      // If customer profile was still the placeholder "User", sync AuthContext so account/navbar reflects name immediately
      const newName = customerProfileName || formData.name.trim();
      if (user && (!user.name || user.name.trim().toLowerCase() === 'user') && newName) {
        updateUser({
          ...user,
          name: newName,
        });
      }

      // Return to calling page (defaults to /checkout) with the savedAddressId so Checkout immediately selects it
      navigate(returnTo, { replace: true, state: { selectedAddressId: savedId } });
    } catch (err: any) {
      console.error('Failed to save address:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save delivery address. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(returnTo || -1)}
              className="w-8 h-8 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18L9 12L15 6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-neutral-900 leading-tight">
                {editAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}
              </h1>
              <p className="text-[11px] text-neutral-500">
                Enter your complete house & street details for accurate delivery
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Quick GPS Location Card */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg flex-shrink-0">
                📍
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Pinpoint Delivery Location</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Autofill your address using current GPS coordinates
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {isLocating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {locatingStatus === 'geocoding' ? 'Getting address...' : 'Detecting your current location...'}
                  </span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="23" />
                    <line x1="1" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="23" y2="12" />
                  </svg>
                  <span>Use Current Location</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Map Preview & Pinning Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">🗺️</span>
              <span className="text-xs font-bold text-neutral-800">Map Location Pin</span>
              {coords.lat !== 0 && (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  GPS Active {accuracy ? `(±${Math.round(accuracy)}m)` : ''}
                </span>
              )}
              {isAddressModifiedAfterPin && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  Pin syncs on save
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowMap(prev => !prev)}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1"
            >
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          </div>

          {showMap && (
            <div className="p-3">
              <div className="rounded-xl overflow-hidden border border-neutral-200">
                <GoogleMapsLocationPicker
                  initialLat={coords.lat}
                  initialLng={coords.lng}
                  onLocationSelect={handleMapLocationSelect}
                  height="220px"
                />
              </div>
              <p className="text-[11px] text-neutral-500 text-center mt-2">
                Tip: Drag the map to place the pin directly over your house or gate
              </p>
            </div>
          )}
        </div>

        {/* Form Container */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-2">
            <h2 className="text-sm font-bold text-neutral-900">Address Information</h2>
            <p className="text-[11px] text-neutral-500">Fields marked with <span className="text-red-500 font-bold">*</span> are required</p>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div>
              <label htmlFor="field-name" className="block text-xs font-semibold text-neutral-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="field-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="Receiver's name"
                className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                  errors.name && touched.name
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                }`}
              />
              {errors.name && touched.name && (
                <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.name}
                </p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="field-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
                Delivery Contact Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-medium text-neutral-500">
                  +91
                </div>
                <input
                  id="field-phone"
                  type="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => handleBlur('phone')}
                  placeholder="10-digit mobile number"
                  className={`w-full pl-10 pr-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                    errors.phone && touched.phone
                      ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                      : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                  }`}
                />
              </div>
              {errors.phone && touched.phone ? (
                <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.phone}
                </p>
              ) : (
                <p className="text-[10px] text-neutral-400 mt-1">Delivery agent will call this number if needed</p>
              )}
            </div>
          </div>

          {/* Flat / House / Building Details */}
          <div>
            <label htmlFor="field-flat" className="block text-xs font-semibold text-neutral-700 mb-1">
              Flat / House No. / Building / Floor <span className="text-red-500">*</span>
            </label>
            <input
              id="field-flat"
              type="text"
              value={formData.flat}
              onChange={(e) => handleInputChange('flat', e.target.value)}
              onBlur={() => handleBlur('flat')}
              placeholder="e.g. Flat 402, Sunshine Heights, 4th Floor"
              className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                errors.flat && touched.flat
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                  : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
              }`}
            />
            {errors.flat && touched.flat && (
              <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                <span>⚠️</span> {errors.flat}
              </p>
            )}
          </div>

          {/* Street / Area */}
          <div>
            <label htmlFor="field-street" className="block text-xs font-semibold text-neutral-700 mb-1">
              Street / Area / Colony <span className="text-red-500">*</span>
            </label>
            <input
              id="field-street"
              type="text"
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              onBlur={() => handleBlur('street')}
              placeholder="e.g. MG Road, Near Central Bus Stand"
              className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                errors.street && touched.street
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                  : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
              }`}
            />
            {errors.street && touched.street && (
              <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                <span>⚠️</span> {errors.street}
              </p>
            )}
          </div>

          {/* Landmark (Optional) */}
          <div>
            <label htmlFor="field-landmark" className="block text-xs font-semibold text-neutral-700 mb-1">
              Landmark <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <input
              id="field-landmark"
              type="text"
              value={formData.landmark}
              onChange={(e) => handleInputChange('landmark', e.target.value)}
              placeholder="e.g. Opposite Shiv Temple, Behind City Mall"
              className="w-full px-3 py-2.5 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
            />
          </div>

          {/* City, State, Pincode 3-column / 2-column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* City */}
            <div>
              <label htmlFor="field-city" className="block text-xs font-semibold text-neutral-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="field-city"
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                onBlur={() => handleBlur('city')}
                placeholder="City"
                className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                  errors.city && touched.city
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                }`}
              />
              {errors.city && touched.city && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.city}</p>
              )}
            </div>

            {/* State */}
            <div>
              <label htmlFor="field-state" className="block text-xs font-semibold text-neutral-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                id="field-state"
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                onBlur={() => handleBlur('state')}
                placeholder="State"
                className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                  errors.state && touched.state
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                }`}
              />
              {errors.state && touched.state && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.state}</p>
              )}
            </div>

            {/* Pincode */}
            <div>
              <label htmlFor="field-pincode" className="block text-xs font-semibold text-neutral-700 mb-1">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                id="field-pincode"
                type="text"
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => handleInputChange('pincode', e.target.value.replace(/\D/g, ''))}
                onBlur={() => handleBlur('pincode')}
                placeholder="6-digit pincode"
                className={`w-full px-3 py-2.5 text-xs bg-white border rounded-xl focus:outline-none transition-colors ${
                  errors.pincode && touched.pincode
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                }`}
              />
              {errors.pincode && touched.pincode && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.pincode}</p>
              )}
            </div>
          </div>

          {/* Address Type Tag */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Save Address As
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'Home', label: 'Home', icon: '🏠' },
                { id: 'Work', label: 'Work', icon: '🏢' },
                { id: 'Hotel', label: 'Hotel', icon: '🏨' },
                { id: 'Other', label: 'Other', icon: '📍' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAddressType(t.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    addressType === t.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Address Checkbox */}
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-neutral-800">Set as default address</span>
              <p className="text-[11px] text-neutral-500">Orders will be delivered here automatically</p>
            </div>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500"
            />
          </div>

          {/* Submit Button (Hidden on Mobile since Fixed Bar is present, visible for keyboard accessibility) */}
          <button type="submit" className="sr-only">Save</button>
        </form>
      </div>

      {/* Sticky Bottom Save Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 z-50 p-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnTo || -1)}
            className="px-4 py-3 border border-neutral-300 text-neutral-700 font-bold rounded-xl text-xs hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-75"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Address...</span>
              </>
            ) : (
              <span>{editAddress ? 'Update Delivery Address' : 'Save & Proceed to Checkout'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
