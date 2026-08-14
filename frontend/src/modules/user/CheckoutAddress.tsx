import { useState, useEffect, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrderAddress } from '../../types/order';
import { getAddresses, addAddress, updateAddress, Address } from '../../services/api/customerAddressService';
import { appConfig } from '../../services/configService';
import { calculateProductPrice } from '../../utils/priceUtils';
import GoogleMapsLocationPicker from '../../components/GoogleMapsLocationPicker';

export default function CheckoutAddress() {
  const { cart } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Get address from navigation state if editing
  const editAddress = (location.state as any)?.editAddress as OrderAddress | undefined;

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [address, setAddress] = useState<OrderAddress>({
    name: editAddress?.name || '',
    phone: editAddress?.phone || '',
    flat: editAddress?.flat || '',
    street: editAddress?.street || '',
    city: editAddress?.city || '',
    pincode: editAddress?.pincode || '',
    state: editAddress?.state || '',
    landmark: editAddress?.landmark || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderAddress, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [orderingFor, setOrderingFor] = useState<'myself' | 'someone-else'>('myself');
  const [addressType, setAddressType] = useState<'home' | 'work' | 'hotel' | 'other'>('home');

  // Location picker state
  const [selectedLatitude, setSelectedLatitude] = useState<number>(0);
  const [selectedLongitude, setSelectedLongitude] = useState<number>(0);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  // Get user's current location on mount


  // Fetch all addresses on mount
  useEffect(() => {
    if (isAuthenticated) {
      const fetchAddresses = async () => {
        try {
          const response = await getAddresses();
          if (response.success && Array.isArray(response.data)) {
            setSavedAddresses(response.data);

            // If not editing, try to load the default 'home' address if it exists
            if (!editAddress) {
              const homeAddr = response.data.find(a => a.type === 'Home');
              if (homeAddr) {
                const parts = homeAddr.address.split(', ');
                setAddress({
                  name: homeAddr.fullName,
                  phone: homeAddr.phone,
                  flat: parts[0] || '',
                  street: parts[1] || '',
                  city: homeAddr.city,
                  state: homeAddr.state || '',
                  pincode: homeAddr.pincode,
                  landmark: homeAddr.landmark || '',
                  id: homeAddr._id,
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching addresses:', error);
        }
      };
      fetchAddresses();
    }
  }, [isAuthenticated, editAddress]);

  // Update address when addressType changes
  useEffect(() => {
    if (!editAddress && savedAddresses.length > 0) {
      const typeLabel = addressType.charAt(0).toUpperCase() + addressType.slice(1) as any;
      const existingAddr = savedAddresses.find(a => a.type === typeLabel);

      if (existingAddr) {
        const parts = existingAddr.address.split(', ');
        setAddress({
          name: existingAddr.fullName,
          phone: existingAddr.phone,
          flat: parts[0] || '',
          street: parts[1] || '',
          city: existingAddr.city,
          state: existingAddr.state || '',
          pincode: existingAddr.pincode,
          landmark: existingAddr.landmark || '',
          id: existingAddr._id,
        });
      } else {
        // Clear or reset to defaults if no address of this type
        setAddress(prev => ({
          ...prev,
          flat: '',
          street: '',
          city: '',
          state: '',
          pincode: '',
          landmark: '',
          id: undefined,
          _id: undefined,
        }));
      }
    }
  }, [addressType, savedAddresses, editAddress]);

  // Update address when editAddress changes
  useEffect(() => {
    if (editAddress) {
      setAddress({
        name: editAddress.name || '',
        phone: editAddress.phone || '',
        flat: editAddress.flat || '',
        street: editAddress.street || '',
        city: editAddress.city || '',
        pincode: editAddress.pincode || '',
        state: editAddress.state || '',
        landmark: editAddress.landmark || '',
      });

      // Try to set address type based on editAddress if it has one
      if ((editAddress as any).type) {
        setAddressType((editAddress as any).type.toLowerCase());
      }
    }
  }, [editAddress]);

  const platformFee = appConfig.platformFee;
  const deliveryFee = cart.total >= appConfig.freeDeliveryThreshold ? 0 : appConfig.deliveryFee;
  const totalAmount = cart.total + platformFee + deliveryFee;

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof OrderAddress, string>> = {};

    if (!address.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!address.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (address.phone.length < 10) {
      newErrors.phone = 'Phone must be at least 10 digits';
    }
    if (!address.flat.trim()) {
      newErrors.flat = 'Flat/House No. is required';
    }
    if (!address.street.trim()) {
      newErrors.street = 'Street/Area is required';
    }
    if (!address.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!address.state?.trim()) {
        newErrors.state = 'State is required';
    }
    if (!address.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (address.pincode.length < 6) {
      newErrors.pincode = 'Pincode must be at least 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof OrderAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSaveAddress = async () => {
    if (!isAuthenticated) {
      showToast('Please login to save your address', 'info');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      let finalLat = selectedLatitude || 0;
      let finalLng = selectedLongitude || 0;

      // Try to geocode if map wasn't used but we have text address
      if (isLoaded && (!finalLat || !finalLng)) {
        const fullAddress = `${address.flat}, ${address.street}, ${address.city}, ${address.state}, ${address.pincode}`;
        try {
          const geocoder = new google.maps.Geocoder();
          const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ address: fullAddress }, (results, status) => {
              if (status === 'OK' && results && results.length > 0) {
                resolve(results);
              } else {
                reject(status);
              }
            });
          });

          if (result && result[0] && result[0].geometry && result[0].geometry.location) {
            finalLat = result[0].geometry.location.lat();
            finalLng = result[0].geometry.location.lng();
            console.log("Geocoded address to:", finalLat, finalLng);
          }
        } catch (e) {
          console.warn("Geocoding failed, proceeding with 0,0", e);
        }
      }

      const payload = {
        fullName: address.name,
        phone: address.phone,
        flat: address.flat,
        street: address.street,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        type: addressType.charAt(0).toUpperCase() + addressType.slice(1) as 'Home' | 'Work' | 'Hotel' | 'Other', // Capitalize
        isDefault: true, // Auto set as default for now
        address: `${address.flat}, ${address.street}`, // Fallback combined string
        latitude: finalLat,
        longitude: finalLng,
      };

      // If editing an existing address, use updateAddress instead
      if (editAddress && (editAddress.id || editAddress._id)) {
        const addressId = editAddress.id || editAddress._id;
        await updateAddress(addressId!, payload);
      } else {
        await addAddress(payload);
      }

      // Show success feedback logic if needed or just navigate
      setTimeout(() => {
        setIsSaving(false);
        navigate('/checkout', { replace: true });
      }, 500);
    } catch (error) {
      console.error('Error saving address:', error);
      setIsSaving(false);
      // Show error toast
    }
  };

  const isFormValid = address.name.trim() !== '' &&
    address.phone.trim().length >= 10 &&
    address.flat.trim() !== '' &&
    address.street.trim() !== '' &&
    address.city.trim() !== '' &&
    (address.state?.trim() || '') !== '' &&
    address.pincode.trim().length >= 6;

  return (
    <div className="pb-24 bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors mr-2"
              aria-label="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-neutral-900">Enter complete address</h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-neutral-200">
        <label className="block text-xs font-medium text-neutral-700 mb-2">
           Delivery Address Details
        </label>
      </div>

      {/* Who you are ordering for? */}
      <div className="px-4 py-2.5 border-b border-neutral-200">
        <p className="text-xs font-medium text-neutral-700 mb-2">Who you are ordering for?</p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="orderingFor"
              value="myself"
              checked={orderingFor === 'myself'}
              onChange={(e) => setOrderingFor(e.target.value as 'myself' | 'someone-else')}
              className="w-4 h-4 appearance-none border-2 border-neutral-300 rounded-full bg-white checked:bg-white checked:border-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
              style={{
                backgroundImage: orderingFor === 'myself'
                  ? 'radial-gradient(circle, rgb(22, 163, 74) 35%, transparent 40%)'
                  : 'none',
                backgroundSize: '40%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <span className="text-xs text-neutral-700">Myself</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="orderingFor"
              value="someone-else"
              checked={orderingFor === 'someone-else'}
              onChange={(e) => setOrderingFor(e.target.value as 'myself' | 'someone-else')}
              className="w-4 h-4 appearance-none border-2 border-neutral-300 rounded-full bg-white checked:bg-white checked:border-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
              style={{
                backgroundImage: orderingFor === 'someone-else'
                  ? 'radial-gradient(circle, rgb(22, 163, 74) 35%, transparent 40%)'
                  : 'none',
                backgroundSize: '40%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <span className="text-xs text-neutral-700">Someone else</span>
          </label>
        </div>
      </div>

      {/* Save address as - Only show when ordering for myself */}
      {orderingFor === 'myself' && (
        <div className="px-4 py-2.5 border-b border-neutral-200">
          <label className="block text-xs font-medium text-neutral-700 mb-2">
            Save address as <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'home', label: 'Home', icon: '🏠' },
              { id: 'work', label: 'Work', icon: '🏢' },
              { id: 'hotel', label: 'Hotel', icon: '🏨' },
              { id: 'other', label: 'Other', icon: '📍' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setAddressType(type.id as typeof addressType)}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${addressType === type.id
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
              >
                <span className="text-sm">{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Address Form */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.name ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="Enter your name"
          />
          {errors.name && <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={address.phone}
            onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.phone ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="Enter mobile number"
            maxLength={10}
          />
          {errors.phone && <p className="text-[10px] text-red-500 mt-0.5">{errors.phone}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Flat / House No. <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.flat}
            onChange={(e) => handleInputChange('flat', e.target.value)}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.flat ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="Flat/House No."
          />
          {errors.flat && <p className="text-[10px] text-red-500 mt-0.5">{errors.flat}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Street / Area <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.street}
            onChange={(e) => handleInputChange('street', e.target.value)}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.street ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="Street/Area"
          />
          {errors.street && <p className="text-[10px] text-red-500 mt-0.5">{errors.street}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.city ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="City"
          />
          {errors.city && <p className="text-[10px] text-red-500 mt-0.5">{errors.city}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.state || ''}
            onChange={(e) => handleInputChange('state', e.target.value)}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.state ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="State"
          />
          {errors.state && <p className="text-[10px] text-red-500 mt-0.5">{errors.state}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Pincode <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address.pincode}
            onChange={(e) => handleInputChange('pincode', e.target.value.replace(/\D/g, ''))}
            className={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors ${errors.pincode ? 'border-red-500' : 'border-neutral-200'
              }`}
            placeholder="Pincode"
            maxLength={6}
          />
          {errors.pincode && <p className="text-[10px] text-red-500 mt-0.5">{errors.pincode}</p>}
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 mb-4">
        <h2 className="text-sm font-bold text-neutral-900 mb-2.5">Order Summary</h2>
        <div className="bg-white rounded-lg border border-neutral-200 p-2.5">
          {/* Cart Items */}
          <div className="space-y-2 mb-3">
            {cart.items.map((item) => {
              const { displayPrice } = calculateProductPrice(item.product);
              return (
                <div key={item.product.id} className="flex items-center justify-between text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate">{item.product.name}</div>
                    <div className="text-[10px] text-neutral-500">
                      {item.product.pack} × {item.quantity}
                    </div>
                  </div>
                  <div className="font-semibold text-neutral-900 ml-2 flex-shrink-0">
                    ₹{(displayPrice * item.quantity).toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-neutral-200 pt-2.5 space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-700">
              <span>Subtotal</span>
              <span className="font-medium">₹{cart.total.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-700">
              <span>Platform Fee</span>
              <span className="font-medium">₹{platformFee}</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-700">
              <span>Delivery Charges</span>
              <span className={`font-medium ${deliveryFee === 0 ? 'text-green-600' : ''}`}>
                {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
              </span>
            </div>
            <div className="border-t border-neutral-200 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-neutral-900">Total</span>
                <span className="text-base font-bold text-neutral-900">₹{totalAmount.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Address Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-[60] shadow-lg">
        <button
          onClick={handleSaveAddress}
          disabled={!isFormValid || isSaving}
          className={`w-full py-3 px-4 font-semibold text-sm transition-colors ${isFormValid && !isSaving
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
            }`}
        >
          {isSaving ? 'Saving...' : 'Save Address'}
        </button>
      </div>
    </div>
  );
}
