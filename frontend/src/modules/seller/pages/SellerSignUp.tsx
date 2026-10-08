import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, sendOTP, verifyOTP } from '../../../services/api/auth/sellerAuthService';
import { removeAuthToken } from '../../../services/api/config';
import OTPInput from '../../../components/OTPInput';
import GoogleMapsAutocomplete from '../../../components/GoogleMapsAutocomplete';
import { useAuth } from '../../../context/AuthContext';
import { getHeaderCategoriesPublic, HeaderCategory } from '../../../services/api/headerCategoryService';
import LocationPickerMap from '../../../components/LocationPickerMap';
import { useAppSettings } from '../../../context/AppSettingsContext';
import sellerLogo from '@assets/seller_logo.jpg';
import {
  buildSellerLocationFields,
  getBrowserStoreCoordinates,
  hasValidStoreCoordinates,
  reverseGeocodeStoreCoordinates,
} from '../../../utils/sellerLocation';
import { filterCategoriesForVendorType } from '../../../utils/sellerCategoryCompatibility';

export default function SellerSignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    sellerName: '',
    mobile: '',
    email: '',
    storeName: '',
    category: '',
    categories: [] as string[],
    vendorType: 'QUICK_COMMERCE' as 'QUICK_COMMERCE' | 'ECOMMERCE' | 'HYBRID',
    wholesaleEnabled: false,
    address: '',
    city: '',
    pickupPincode: '',
    pickupAddress: '',
    pickupState: '',
    searchLocation: '',
    latitude: '',
    longitude: '',
    serviceRadiusKm: '10', // Default 10km
  });
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const locationRequestRef = useRef(0);
  const [categories, setCategories] = useState<HeaderCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const { settings } = useAppSettings();
  const qcEnabled = settings.commerceChannels?.quickCommerceEnabled !== false;
  const ecomEnabled = settings.commerceChannels?.ecommerceEnabled === true;
  const hybridEnabled = qcEnabled && ecomEnabled;

  useEffect(() => {
    if (!qcEnabled && formData.vendorType === 'QUICK_COMMERCE') {
      setFormData(prev => ({ ...prev, vendorType: 'ECOMMERCE' }));
    } else if (!ecomEnabled && formData.vendorType === 'ECOMMERCE') {
      setFormData(prev => ({ ...prev, vendorType: 'QUICK_COMMERCE' }));
    } else if (!hybridEnabled && formData.vendorType === 'HYBRID') {
      setFormData(prev => ({ ...prev, vendorType: qcEnabled ? 'QUICK_COMMERCE' : 'ECOMMERCE' }));
    }
  }, [qcEnabled, ecomEnabled, hybridEnabled, formData.vendorType]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getHeaderCategoriesPublic();
        if (Array.isArray(res)) {
          setCategories(res.filter(cat => cat.status === 'Published'));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setCategoriesLoaded(true);
      }
    };
    fetchCats();
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      setFormData(prev => ({
        ...prev,
        [name]: value.replace(/\D/g, '').slice(0, 10),
      }));
    } else if (name === 'serviceRadiusKm') {
      // Allow only numbers and a single decimal point
      const cleanedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = cleanedValue.split('.');
      const finalValue = parts.length > 2 ? `${parts[0]}.${parts[1]}` : cleanedValue;

      setFormData(prev => ({
        ...prev,
        [name]: finalValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => {
      const exists = prev.categories.includes(cat);
      const nextCategories = exists
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat];
      return {
        ...prev,
        categories: nextCategories,
        category: nextCategories[0] || '',
      };
    });
  };

  const applyResolvedStoreLocation = useCallback(async (latitude: number, longitude: number) => {
    const requestId = ++locationRequestRef.current;
    setLocationLoading(true);
    setLocationError('');
    setFormData(prev => ({
      ...prev,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      address: '',
      searchLocation: '',
    }));

    try {
      const resolved = await reverseGeocodeStoreCoordinates(latitude, longitude);
      if (requestId !== locationRequestRef.current) return;
      const fields = buildSellerLocationFields(
        resolved.formattedAddress,
        latitude,
        longitude,
        { city: resolved.city, state: resolved.state, pincode: resolved.pincode }
      );
      setFormData(prev => ({
        ...prev,
        ...fields,
        city: fields.city || prev.city,
        pickupState: fields.pickupState || prev.pickupState,
        pickupPincode: fields.pickupPincode || prev.pickupPincode,
      }));
    } catch (locationLookupError: any) {
      if (requestId !== locationRequestRef.current) return;
      setLocationError(locationLookupError?.message || 'Unable to determine the address. Please move the pin or try again.');
    } finally {
      if (requestId === locationRequestRef.current) setLocationLoading(false);
    }
  }, []);

  const compatibleCategories = useMemo(
    () => filterCategoriesForVendorType(categories, formData.vendorType),
    [categories, formData.vendorType]
  );

  useEffect(() => {
    if (!categoriesLoaded) return;
    const compatibleNames = new Set(compatibleCategories.map((category) => category.name));
    setFormData((previous) => {
      const nextCategories = previous.categories.filter((name) => compatibleNames.has(name));
      if (
        nextCategories.length === previous.categories.length
        && nextCategories.every((name, index) => name === previous.categories[index])
      ) {
        return previous;
      }
      return { ...previous, categories: nextCategories, category: nextCategories[0] || '' };
    });
  }, [categoriesLoaded, compatibleCategories]);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError('');
    try {
      const coords = await getBrowserStoreCoordinates();
      await applyResolvedStoreLocation(coords.latitude, coords.longitude);
    } catch (geolocationError: any) {
      setLocationError(geolocationError?.message || 'Unable to get your current location. Search for your store address or try again.');
      setLocationLoading(false);
    }
  }, [applyResolvedStoreLocation]);

  const handleMapLocationSelect = useCallback((latitude: number, longitude: number) => {
    const previousLatitude = Number(formData.latitude);
    const previousLongitude = Number(formData.longitude);
    if (
      Number.isFinite(previousLatitude)
      && Number.isFinite(previousLongitude)
      && Math.abs(previousLatitude - latitude) < 0.000001
      && Math.abs(previousLongitude - longitude) < 0.000001
    ) {
      return;
    }
    void applyResolvedStoreLocation(latitude, longitude);
  }, [applyResolvedStoreLocation, formData.latitude, formData.longitude]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields (password removed - not needed during signup)
    if (!formData.sellerName) {
      setError('Please enter your name');
      return;
    }
    if (!formData.mobile) {
      setError('Please enter your mobile number');
      return;
    }
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }
    if (!formData.storeName) {
      setError('Please enter your store name');
      return;
    }
    if (formData.categories.length === 0) {
      setError('Please select at least one category');
      return;
    }
    const compatibleNames = new Set(compatibleCategories.map((item) => item.name));
    if (formData.categories.some((name) => !compatibleNames.has(name))) {
      setError('One or more selected categories are not compatible with the selected vendor business type');
      return;
    }
    if (!formData.address.trim()) {
      setError('Please select a valid store address');
      return;
    }
    if (!formData.city) {
      setError('Please enter your city');
      return;
    }

    if (formData.mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!hasValidStoreCoordinates(formData.latitude, formData.longitude)) {
        setError('Please search for your store address or select a valid location on the map');
        return;
      }

      if (formData.vendorType !== 'ECOMMERCE') {
        // Validate service radius
        const radius = parseFloat(formData.serviceRadiusKm);
        if (isNaN(radius) || radius < 0.1 || radius > 300) {
          setError('Service radius must be between 0.1 and 300 kilometers');
          return;
        }
      }

      if (formData.vendorType === 'ECOMMERCE' || formData.vendorType === 'HYBRID') {
        if (!formData.pickupPincode || !/^[1-9][0-9]{5}$/.test(formData.pickupPincode)) {
          setError('Please enter a valid 6-digit pickup pincode for courier shipments');
          return;
        }
        if (!formData.pickupState.trim()) {
          setError('Please enter the pickup state for courier shipments');
          return;
        }
      }

      const response = await register({
        sellerName: formData.sellerName,
        mobile: formData.mobile,
        email: formData.email,
        storeName: formData.storeName,
        category: formData.categories[0], // primary
        categories: formData.categories,
        vendorType: formData.vendorType,
        wholesaleEnabled: formData.wholesaleEnabled,
        address: formData.address || formData.searchLocation,
        city: formData.city,
        searchLocation: formData.searchLocation,
        latitude: formData.latitude,
        longitude: formData.longitude,
        serviceRadiusKm: formData.serviceRadiusKm,
        pickupPincode: formData.pickupPincode,
        pickupAddress: formData.pickupAddress || formData.address,
        pickupCity: formData.city,
        pickupState: formData.pickupState,
      });

      if (response.success) {
        // Clear token from registration (we'll get it after OTP verification)
        removeAuthToken('seller');
        // Registration successful, now send OTP for verification
        try {
          await sendOTP(formData.mobile);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(otpErr.response?.data?.message || 'Registration successful but failed to send OTP.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(formData.mobile, otp);
      if (response.success && response.data) {
        // Update auth context with seller data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.sellerName,
          email: response.data.user.email,
          phone: response.data.user.mobile,
          userType: 'Seller',
          storeName: response.data.user.storeName,
          status: response.data.user.status,
          address: response.data.user.address,
          city: response.data.user.city,
        });
        // Navigate to seller dashboard
        navigate('/seller', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-50 flex flex-col items-center justify-center px-4 py-8 seller-app-root">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-neutral-50 transition-colors"
        aria-label="Back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Sign Up Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <div className="px-6 py-4 text-center border-b border-green-700 bg-white">
          <div className="mb-2">
            <img
              src={sellerLogo}
              alt="Olovely Total Suvidha"
              className="h-24 w-auto max-w-xs mx-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Seller Sign Up</h1>
          <p className="text-neutral-600 text-sm">Create your Olovely seller account</p>
        </div>

        {/* Sign Up Form */}
        <div className="p-6 space-y-4 seller-signup-form" style={{ maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .seller-signup-form::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Required Fields Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">Required Information</h3>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Vendor Business Type <span className="text-red-500">*</span>
                  </label>
                  <div className={`grid gap-2 ${(qcEnabled && ecomEnabled) ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {qcEnabled && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, vendorType: 'QUICK_COMMERCE' }))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          formData.vendorType === 'QUICK_COMMERCE'
                            ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-200'
                            : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between gap-1">
                          <span>⚡ Quick Commerce</span>
                          {formData.vendorType === 'QUICK_COMMERCE' && (
                            <span className="text-teal-600 text-xs font-bold">✓</span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Hyperlocal Delivery
                        </div>
                      </button>
                    )}

                    {ecomEnabled && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, vendorType: 'ECOMMERCE' }))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          formData.vendorType === 'ECOMMERCE'
                            ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-200'
                            : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between gap-1">
                          <span>📦 Ecommerce</span>
                          {formData.vendorType === 'ECOMMERCE' && (
                            <span className="text-teal-600 text-xs font-bold">✓</span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Courier Shipping
                        </div>
                      </button>
                    )}

                    {hybridEnabled && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, vendorType: 'HYBRID' }))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          formData.vendorType === 'HYBRID'
                            ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-200'
                            : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between gap-1">
                          <span>🔄 Hybrid</span>
                          {formData.vendorType === 'HYBRID' && (
                            <span className="text-teal-600 text-xs font-bold">✓</span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Both Channels
                        </div>
                      </button>
                    )}
                  </div>
                  {!hybridEnabled && (
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> {qcEnabled ? 'E-Commerce is currently disabled by platform administration.' : 'Quick Commerce is currently disabled by platform administration.'} Only {qcEnabled ? 'Quick Commerce' : 'E-Commerce'} seller registration is currently accepted.
                    </p>
                  )}

                  {/* Wholesale Selling Capability */}
                  <div className="mt-3 p-3.5 bg-neutral-50 rounded-lg border border-neutral-200">
                    <span className="block text-xs font-bold text-neutral-800">Wholesale Selling</span>
                    <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.wholesaleEnabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, wholesaleEnabled: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded border-neutral-300 focus:ring-teal-500 cursor-pointer"
                        disabled={loading}
                      />
                      <span className="text-xs font-medium text-neutral-700">
                        I want to sell wholesale products
                      </span>
                    </label>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Offer bulk products with special wholesale pricing and minimum order quantities.
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1.5 italic">
                      Wholesale is an optional selling capability. Your delivery method still depends on the product's commerce type.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Seller Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="sellerName"
                    value={formData.sellerName}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200">
                    <div className="px-3 py-2.5 text-sm font-medium text-neutral-600 border-r border-neutral-300 bg-neutral-50">
                      +91
                    </div>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      placeholder="Enter mobile number"
                      required
                      maxLength={10}
                      className="flex-1 px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleInputChange}
                    placeholder="Enter store name"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Categories <span className="text-red-500">*</span>
                  </label>
                  {!categoriesLoaded ? (
                    <div className="text-sm text-neutral-500 py-2">
                      Loading categories...
                    </div>
                  ) : compatibleCategories.length === 0 ? (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      No published categories currently support this commerce capability.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-neutral-200 rounded-lg">
                      {compatibleCategories.map((cat) => {
                        const checked = formData.categories.includes(cat.name);
                        return (
                          <label key={cat._id} className="flex items-center gap-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(cat.name)}
                              disabled={loading}
                              className="h-4 w-4 text-teal-600 border-neutral-300 rounded focus:ring-teal-500"
                            />
                            <span>{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {formData.categories.length === 0 && compatibleCategories.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Select at least one compatible category</p>
                  )}
                </div>

                {/* Store address and internal coordinates for every seller channel */}
                <>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="block text-sm font-medium text-neutral-700">
                          Store Location <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          disabled={loading || locationLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-wait disabled:opacity-60">
                          <span aria-hidden="true">📍</span>
                          {locationLoading ? 'Finding Address...' : 'Use Current Location'}
                        </button>
                      </div>

                      <label className="mb-1 block text-xs font-medium text-neutral-600">
                        Search your store address
                      </label>
                      <div className="min-w-0">
                          <GoogleMapsAutocomplete
                            value={formData.searchLocation}
                            onChange={(address, lat, lng, _placeName, components) => {
                              if (!hasValidStoreCoordinates(lat, lng) || (lat === 0 && lng === 0)) {
                                setFormData(prev => ({
                                  ...prev,
                                  searchLocation: address,
                                  address: '',
                                  latitude: '',
                                  longitude: '',
                                }));
                                return;
                              }
                              const formattedAddress = components?.formattedAddress || address;
                              const fields = buildSellerLocationFields(formattedAddress, lat, lng, components);
                              setFormData(prev => ({
                                ...prev,
                                ...fields,
                                city: fields.city || prev.city,
                                pickupState: fields.pickupState || prev.pickupState,
                                pickupPincode: fields.pickupPincode || prev.pickupPincode,
                              }));
                              setLocationError('');
                            }}
                            placeholder="Search and select your store address..."
                            disabled={loading || locationLoading}
                            required
                          />
                      </div>

                      {locationError && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800" role="alert">
                          {locationError}
                        </p>
                      )}

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Store Address</label>
                        <div className="min-h-[64px] w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-5 text-neutral-700 break-words">
                          {formData.address || 'Select an address result or use your current location.'}
                        </div>
                      </div>

                      {formData.latitude && formData.longitude ? (
                        <div className="mt-4 animate-fadeIn">
                          <p className="text-sm font-medium text-neutral-700 mb-2">
                            Exact Location <span className="text-teal-600 text-xs font-normal">(Move the map to place the pin on your store's entrance)</span>
                          </p>
                          <LocationPickerMap
                            initialLat={parseFloat(formData.latitude)}
                            initialLng={parseFloat(formData.longitude)}
                            onLocationSelect={handleMapLocationSelect}
                            height="260px"
                          />
                          <p className="mt-1 text-xs text-neutral-500 text-center">
                            Move the map to place the pin on your store's exact entrance.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-neutral-500 bg-neutral-50 p-2 rounded border border-neutral-100 text-center">
                          Search for a location or use the location button to view the map and set exact coordinates.
                        </div>
                      )}
                    </div>

                  {formData.vendorType !== 'ECOMMERCE' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Delivery/Service Radius (KM) <span className="text-red-500">*</span>
                        <span className="text-xs font-normal text-neutral-500 ml-1">(0.1 KM - 300 KM)</span>
                      </label>
                      <input
                        type="number"
                        name="serviceRadiusKm"
                        value={formData.serviceRadiusKm}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="Enter service radius in KM (e.g. 10)"
                        required
                        min="0.1"
                        max="300"
                        step="0.1"
                        className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        disabled={loading}
                      />
                      <p className="mt-1 text-xs text-neutral-500">
                        Only customers within this radius can see and order your Quick Commerce products
                      </p>
                    </div>
                  )}
                </>

                {/* Ecommerce & Hybrid Courier Shipping Configuration */}
                {formData.vendorType !== 'QUICK_COMMERCE' && (
                  <div className="space-y-4 p-4 bg-amber-50/60 rounded-xl border border-amber-200/70">
                    <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      📦 Courier Shipping Pickup Details
                    </h4>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Pickup Pincode <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="pickupPincode"
                        value={formData.pickupPincode}
                        onChange={(e) => setFormData(prev => ({ ...prev, pickupPincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="e.g. 110001 (6-digit postal code)"
                        maxLength={6}
                        required={formData.vendorType === 'ECOMMERCE'}
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Pickup State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="pickupState"
                        value={formData.pickupState}
                        onChange={handleInputChange}
                        placeholder="e.g. Maharashtra"
                        required
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs leading-5 text-amber-800">
                      Courier pickup will use the Store Address selected above. Pickup creation remains part of the existing approval workflow.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                    disabled={loading}
                  />
                </div>

                {/* Hidden fields for coordinates */}
                <input type="hidden" name="latitude" value={formData.latitude} />
                <input type="hidden" name="longitude" value={formData.longitude} />



              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${!loading
                  ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                  : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  }`}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>

              {/* Login Link */}
              <div className="text-center pt-2 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Already have a seller account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/seller/login')}
                    className="text-teal-600 hover:text-teal-700 font-semibold"
                  >
                    Login
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* OTP Verification Form */
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-2">
                  Enter the 4-digit OTP sent to
                </p>
                <p className="text-sm font-semibold text-neutral-800">+91 {formData.mobile}</p>
              </div>

              <OTPInput onComplete={handleOTPComplete} disabled={loading} />

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      await sendOTP(formData.mobile);
                    } catch (err: any) {
                      setError(err.response?.data?.message || 'Failed to resend OTP.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  {loading ? 'Sending...' : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Text */}
      <p className="mt-6 text-xs text-neutral-500 text-center max-w-md">
        By continuing, you agree to Olovely's Terms of Service and Privacy Policy
      </p>
    </div>
  );
}


