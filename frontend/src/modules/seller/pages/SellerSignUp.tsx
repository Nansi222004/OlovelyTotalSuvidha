import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, sendOTP, verifyOTP } from '../../../services/api/auth/sellerAuthService';
import { removeAuthToken } from '../../../services/api/config';
import OTPInput from '../../../components/OTPInput';
import GoogleMapsAutocomplete from '../../../components/GoogleMapsAutocomplete';
import { useAuth } from '../../../context/AuthContext';
import { getHeaderCategoriesPublic, HeaderCategory } from '../../../services/api/headerCategoryService';
import LocationPickerMap from '../../../components/LocationPickerMap';
import { useEffect } from 'react';

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
    address: '',
    city: '',
    panCard: '',
    taxName: '',
    taxNumber: '',
    searchLocation: '',
    latitude: '',
    longitude: '',
    serviceRadiusKm: '10', // Default 10km
    accountName: '',
    bankName: '',
    branch: '',
    accountNumber: '',
    ifsc: '',
  });
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<HeaderCategory[]>([]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getHeaderCategoriesPublic();
        if (Array.isArray(res)) {
          setCategories(res.filter(cat => cat.status === 'Published'));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
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
    if (!formData.address && !formData.searchLocation) {
      setError('Please select your store location');
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
      // Validate location is selected
      if (!formData.searchLocation || !formData.latitude || !formData.longitude) {
        setError('Please select your store location using the location search');
        return;
      }

      // Validate service radius
      const radius = parseFloat(formData.serviceRadiusKm);
      if (isNaN(radius) || radius < 0.1 || radius > 300) {
        setError('Service radius must be between 0.1 and 300 kilometers');
        return;
      }

      const response = await register({
        sellerName: formData.sellerName,
        mobile: formData.mobile,
        email: formData.email,
        storeName: formData.storeName,
        category: formData.categories[0], // primary
        categories: formData.categories,
        address: formData.address || formData.searchLocation,
        city: formData.city,
        searchLocation: formData.searchLocation,
        latitude: formData.latitude,
        longitude: formData.longitude,
        serviceRadiusKm: formData.serviceRadiusKm,
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-50 flex flex-col items-center justify-center px-4 py-8">
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
              src="/assets/olovelylogo_transparent.png"
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
                  {categories.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-2">
                      Loading categories...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-neutral-200 rounded-lg">
                      {categories.map((cat) => {
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
                  {formData.categories.length === 0 && categories.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Select at least one category</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Store Location <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <GoogleMapsAutocomplete
                        value={formData.searchLocation}
                        onChange={(address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string }) => {
                          setFormData(prev => ({
                            ...prev,
                            searchLocation: address,
                            latitude: lat.toString(),
                            longitude: lng.toString(),
                            address: address,
                            city: components?.city || prev.city,
                          }));
                        }}
                        placeholder="Search your store location..."
                        disabled={loading}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          setLoading(true);
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const lat = position.coords.latitude;
                              const lng = position.coords.longitude;
                              const locationStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                              setFormData(prev => ({
                                ...prev,
                                latitude: lat.toString(),
                                longitude: lng.toString(),
                                searchLocation: locationStr,
                                address: prev.address || locationStr // Ensure address is not empty
                              }));
                              setLoading(false);
                            },
                            (error) => {
                              console.error(error);
                              setError('Unable to retrieve your location');
                              setLoading(false);
                            }
                          );
                        } else {
                          setError('Geolocation is not supported by your browser');
                        }
                      }}
                      className="p-2.5 bg-teal-50 text-teal-600 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
                      title="Use Current Location"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" />
                        <path d="M12 8v8" />
                        <path d="M8 12h8" />
                      </svg>
                    </button>
                  </div>

                  {formData.latitude && formData.longitude ? (
                    <div className="mt-4 animate-fadeIn">
                       <p className="text-sm font-medium text-neutral-700 mb-2">
                        Exact Location <span className="text-teal-600 text-xs font-normal">(Move the map to place the pin on your store's entrance)</span>
                      </p>
                      <LocationPickerMap
                        initialLat={parseFloat(formData.latitude)}
                        initialLng={parseFloat(formData.longitude)}
                        onLocationSelect={(lat, lng) => {
                          setFormData(prev => ({
                            ...prev,
                            latitude: lat.toString(),
                            longitude: lng.toString()
                          }));
                        }}
                      />
                      <p className="mt-1 text-xs text-neutral-500 text-center">
                        Selected Coordinates: {formData.latitude}, {formData.longitude}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-neutral-500 bg-neutral-50 p-2 rounded border border-neutral-100 text-center">
                      Search for a location or use the location button to view the map and set exact coordinates.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Delivery/Service Radius (KM) <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-neutral-500 ml-1">(Distance you can deliver)</span>
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
                    Only customers within this radius can see and order your products
                  </p>
                </div>

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

              {/* Optional Fields Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">Optional Information</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">PAN Card</label>
                    <input
                      type="text"
                      name="panCard"
                      value={formData.panCard}
                      onChange={handleInputChange}
                      placeholder="PAN Card Number"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Tax Name</label>
                    <input
                      type="text"
                      name="taxName"
                      value={formData.taxName}
                      onChange={handleInputChange}
                      placeholder="Tax Name"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Tax Number</label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={formData.taxNumber}
                      onChange={handleInputChange}
                      placeholder="Tax Number"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc"
                      value={formData.ifsc}
                      onChange={handleInputChange}
                      placeholder="IFSC Code"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      disabled={loading}
                    />
                  </div>
                </div>
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


