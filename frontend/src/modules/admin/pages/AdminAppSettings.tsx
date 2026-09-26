import React, { useState, useEffect, useRef } from 'react';
import { getAppSettings, updateAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';
import api from '../../../services/api/config';
import { notifyAppSettingsUpdated } from '../../../context/AppSettingsContext';

export default function AdminAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<AppSettings>>({
    appName: 'Olovely Total Suvidha',
    appLogo: '/assets/olovelylogo_transparent.png',
    appFavicon: '/favicon.ico',
    estimatedDeliveryTime: '12-15 mins',
    contactEmail: 'contact@olovely.com',
    contactPhone: '9876543210',
    supportEmail: 'support@olovely.com',
    supportPhone: '9876543210',
    companyAddress: 'Indore City, Madhya Pradesh, 452001',
    companyCity: 'Indore',
    companyState: 'Madhya Pradesh',
    companyPincode: '452001',
    deliveryCharges: 0,
    platformFee: 2,
    freeDeliveryThreshold: 199,
    commerceChannels: {
      quickCommerceEnabled: true,
      ecommerceEnabled: true,
    },
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    channel: 'QUICK_COMMERCE' | 'ECOMMERCE';
    title: string;
    message: string;
  } | null>(null);
  const [updatingChannel, setUpdatingChannel] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getAppSettings();
      if (res && res.success && res.data) {
        setFormData((prev) => ({
          ...prev,
          ...res.data,
          appName: res.data.appName || 'Olovely Total Suvidha',
          appLogo: res.data.appLogo || '/assets/olovelylogo_transparent.png',
          estimatedDeliveryTime: (res.data as any).estimatedDeliveryTime || '12-15 mins',
        }));
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load app settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AppSettings | string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleToggleCommerceChannel = async (channelKey: 'quickCommerceEnabled' | 'ecommerceEnabled') => {
    const currentQC = formData.commerceChannels?.quickCommerceEnabled !== false;
    const currentEcom = formData.commerceChannels?.ecommerceEnabled !== false;

    if (channelKey === 'quickCommerceEnabled') {
      const willTurnOff = currentQC;
      if (willTurnOff) {
        if (!currentEcom) {
          setErrorMessage('At least one commerce channel must remain enabled. You cannot disable Quick Commerce while E-Commerce is already disabled.');
          return;
        }
        setConfirmModal({
          isOpen: true,
          channel: 'QUICK_COMMERCE',
          title: 'Disable Quick Commerce?',
          message: 'New Quick Commerce registrations, product listings, cart checkout, and new orders will be blocked. Existing orders will continue normally.',
        });
        return;
      } else {
        await applyChannelUpdate({ quickCommerceEnabled: true, ecommerceEnabled: currentEcom });
      }
    } else if (channelKey === 'ecommerceEnabled') {
      const willTurnOff = currentEcom;
      if (willTurnOff) {
        if (!currentQC) {
          setErrorMessage('At least one commerce channel must remain enabled. You cannot disable E-Commerce while Quick Commerce is already disabled.');
          return;
        }
        setConfirmModal({
          isOpen: true,
          channel: 'ECOMMERCE',
          title: 'Disable E-Commerce?',
          message: 'New E-Commerce registrations, product listings, cart checkout, and new orders will be blocked. Existing orders will continue normally.',
        });
        return;
      } else {
        await applyChannelUpdate({ quickCommerceEnabled: currentQC, ecommerceEnabled: true });
      }
    }
  };

  const applyChannelUpdate = async (channels: { quickCommerceEnabled: boolean; ecommerceEnabled: boolean }) => {
    try {
      setUpdatingChannel(true);
      setErrorMessage('');
      setSuccessMessage('');

      const res = await updateAppSettings({
        commerceChannels: channels,
      });

      if (res && res.success) {
        setFormData((prev) => ({
          ...prev,
          commerceChannels: channels,
        }));
        setSuccessMessage('Commerce channel availability updated successfully!');
        notifyAppSettingsUpdated();
      } else {
        setErrorMessage(res?.message || 'Failed to update channel availability');
      }
    } catch (err: any) {
      console.error('Failed to update commerce channels:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to update commerce channel settings');
    } finally {
      setUpdatingChannel(false);
      setConfirmModal(null);
    }
  };

  const handleToggleFirstOrderFreeShipping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    handleInputChange('firstOrderFreeShippingEnabled', newValue);
    try {
      const res = await updateAppSettings({ firstOrderFreeShippingEnabled: newValue });
      if (res && res.success) {
        setSuccessMessage(`First Order Free Shipping ${newValue ? 'enabled' : 'disabled'} successfully!`);
        notifyAppSettingsUpdated();
      }
    } catch (err: any) {
      console.error('Failed to toggle first order free shipping:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setErrorMessage('');
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);
      uploadFormData.append('folder', 'app_branding');

      const response = await api.post('/upload/image', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data && response.data.success && response.data.data) {
        const uploadedUrl = response.data.data.url || response.data.data.secure_url || response.data.data.path;
        handleInputChange('appLogo', uploadedUrl);
        setSuccessMessage('Logo uploaded successfully! Click "Save Settings" to apply.');
      } else {
        setErrorMessage(response.data?.message || 'Failed to upload logo');
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to upload image file');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');

      const qc = formData.commerceChannels?.quickCommerceEnabled !== false;
      const ecom = formData.commerceChannels?.ecommerceEnabled !== false;
      if (!qc && !ecom) {
        setErrorMessage('At least one commerce channel must remain enabled.');
        setSaving(false);
        return;
      }

      const res = await updateAppSettings(formData);
      if (res && res.success) {
        setSuccessMessage('App Settings and Branding updated successfully!');
        // Refresh customer context across all tabs
        notifyAppSettingsUpdated();
      } else {
        setErrorMessage(res?.message || 'Failed to update settings');
      }
    } catch (err: any) {
      console.error('Save settings error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setErrorMessage('Admin session expired or unauthorized. Please log in at the Admin Portal (admin@olovely.com / Admin@123) to save changes.');
      } else {
        setErrorMessage(err.response?.data?.message || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">App Settings & Branding</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Configure dynamic app logo, application title, estimated delivery time, and contact info.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || uploadingLogo}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 gap-2 cursor-pointer"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>{errorMessage}</span>
          </div>
          {errorMessage.includes('log in') && (
            <a
              href="/admin/login"
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold self-start sm:self-auto transition-colors whitespace-nowrap"
            >
              Go to Admin Login
            </a>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* COMMERCE CHANNELS CARD */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                <span>COMMERCE CHANNELS</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200">
                  Global Availability
                </span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Control global availability of Quick Commerce and E-Commerce. At least one commerce channel must remain enabled.
              </p>
            </div>
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 self-start sm:self-auto">
              <span>⚠️</span>
              <span>At least one channel must always remain enabled.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Quick Commerce */}
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between gap-4 transition-all hover:bg-white hover:shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-neutral-800 flex items-center gap-1.5">
                    <span>⚡</span> Quick Commerce
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                    (formData.commerceChannels?.quickCommerceEnabled !== false)
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {(formData.commerceChannels?.quickCommerceEnabled !== false) ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 font-medium">Local / Hyperlocal Delivery (10–30 min delivery radius)</p>
                <p className="text-[11px] text-neutral-400">Controls instant local rider delivery fulfillment.</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.commerceChannels?.quickCommerceEnabled !== false}
                  onChange={() => handleToggleCommerceChannel('quickCommerceEnabled')}
                  disabled={updatingChannel}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* E-Commerce */}
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between gap-4 transition-all hover:bg-white hover:shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-neutral-800 flex items-center gap-1.5">
                    <span>📦</span> E-Commerce
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                    (formData.commerceChannels?.ecommerceEnabled !== false)
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {(formData.commerceChannels?.ecommerceEnabled !== false) ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 font-medium">Courier / Shipping Delivery across serviceable pincodes</p>
                <p className="text-[11px] text-neutral-400">Controls standard courier shipping (Shiprocket).</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.commerceChannels?.ecommerceEnabled !== false}
                  onChange={() => handleToggleCommerceChannel('ecommerceEnabled')}
                  disabled={updatingChannel}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Card 1: Brand & Logo */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-lg font-semibold text-neutral-800">Brand Identity & Header</h2>
            <p className="text-xs text-neutral-500">Configure how the app header appears to users on Mobile and Desktop.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* App Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                App Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.appName || ''}
                onChange={(e) => handleInputChange('appName', e.target.value)}
                placeholder="e.g. Olovely Total Suvidha"
                className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">Displayed on the top header next to the logo.</p>
            </div>

            {/* Estimated Delivery Time */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estimated Delivery Time Text <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).estimatedDeliveryTime || ''}
                onChange={(e) => handleInputChange('estimatedDeliveryTime', e.target.value)}
                placeholder="e.g. 12-15 mins"
                className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">Main prominent delivery pill in the hero header.</p>
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              App Logo Image <span className="text-red-500">*</span>
            </label>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Preview Thumbnail */}
              <div className="w-24 h-24 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-center p-2 overflow-hidden shadow-inner flex-shrink-0 relative group">
                <img
                  src={formData.appLogo || '/assets/olovelylogo_transparent.png'}
                  alt="App Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/olovelylogo.png';
                  }}
                />
              </div>

              {/* Upload & URL Controls */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2 border border-neutral-300 disabled:opacity-50 cursor-pointer"
                  >
                    {uploadingLogo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-neutral-700 border-t-transparent rounded-full animate-spin"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>Upload New Logo</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange('appLogo', '/assets/olovelylogo_transparent.png')}
                    className="px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 hover:underline"
                  >
                    Reset to Default
                  </button>
                </div>

                {/* Direct Image URL input */}
                <div>
                  <input
                    type="text"
                    value={formData.appLogo || ''}
                    onChange={(e) => handleInputChange('appLogo', e.target.value)}
                    placeholder="Or enter image URL: https://... or /assets/..."
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg text-neutral-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-neutral-400">Recommended: Transparent PNG or SVG, at least 120x120 pixels.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Contact & Support */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-lg font-semibold text-neutral-800">Support & Contact Information</h2>
            <p className="text-xs text-neutral-500">Contact details shown in the customer account and help sections.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.contactPhone || ''}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Support Email</label>
              <input
                type="email"
                value={formData.supportEmail || ''}
                onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Support Phone</label>
              <input
                type="text"
                value={formData.supportPhone || ''}
                onChange={(e) => handleInputChange('supportPhone', e.target.value)}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Delivery Fees & Thresholds */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-lg font-semibold text-neutral-800">Order Fees & Thresholds</h2>
            <p className="text-xs text-neutral-500">Global platform fee and free delivery thresholds.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Platform Fee (₹)</label>
              <input
                type="number"
                value={formData.platformFee ?? 2}
                onChange={(e) => handleInputChange('platformFee', Number(e.target.value))}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Standard Delivery Fee (₹)</label>
              <input
                type="number"
                value={formData.deliveryCharges ?? 0}
                onChange={(e) => handleInputChange('deliveryCharges', Number(e.target.value))}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Free Delivery Min Order (₹)</label>
              <input
                type="number"
                value={formData.freeDeliveryThreshold ?? 500}
                onChange={(e) => handleInputChange('freeDeliveryThreshold', Number(e.target.value))}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-800">FREE SHIPPING FOR FIRST ORDER</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  formData.firstOrderFreeShippingEnabled ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {formData.firstOrderFreeShippingEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Give new customers free shipping on their first eligible order.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.firstOrderFreeShippingEnabled)}
                onChange={handleToggleFirstOrderFreeShipping}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>
        </div>

        {/* Card 4: About Us CMS Manager */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-lg font-semibold text-neutral-800">About Us Page Content (CMS)</h2>
            <p className="text-xs text-neutral-500">
              Customize Mission, What We Do text, key statistics, and Why Choose Us cards displayed on the customer About Us page.
            </p>
          </div>

          {/* Mission */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Our Mission</label>
            <textarea
              rows={3}
              value={formData.aboutUs?.missionText || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  aboutUs: {
                    ...prev.aboutUs,
                    missionText: e.target.value,
                  },
                }))
              }
              placeholder="At Olovely, we're committed to revolutionizing the way you shop..."
              className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* What We Do */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">What We Do</label>
            <textarea
              rows={3}
              value={formData.aboutUs?.whatWeDoText || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  aboutUs: {
                    ...prev.aboutUs,
                    whatWeDoText: e.target.value,
                  },
                }))
              }
              placeholder="Olovely Total Suvidha is a comprehensive e-commerce platform..."
              className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Statistics Grid Manager */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-neutral-700">Statistics Badges</label>
              <button
                type="button"
                onClick={() => {
                  const currentStats = formData.aboutUs?.stats || [
                    { value: "10K+", label: "Products" },
                    { value: "500+", label: "Sellers" },
                    { value: "50K+", label: "Happy Customers" },
                    { value: "24/7", label: "Support" },
                  ];
                  setFormData((prev) => ({
                    ...prev,
                    aboutUs: {
                      ...prev.aboutUs,
                      stats: [...currentStats, { value: '', label: '' }],
                    },
                  }));
                }}
                className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold rounded-lg border border-teal-200 transition-colors cursor-pointer"
              >
                + Add Statistic
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(formData.aboutUs?.stats || [
                { value: "10K+", label: "Products" },
                { value: "500+", label: "Sellers" },
                { value: "50K+", label: "Happy Customers" },
                { value: "24/7", label: "Support" },
              ]).map((stat, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => {
                      const updated = [...(formData.aboutUs?.stats || [
                        { value: "10K+", label: "Products" },
                        { value: "500+", label: "Sellers" },
                        { value: "50K+", label: "Happy Customers" },
                        { value: "24/7", label: "Support" },
                      ])];
                      updated[idx] = { ...updated[idx], value: e.target.value };
                      setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, stats: updated } }));
                    }}
                    placeholder="Value (e.g. 10K+)"
                    className="w-1/3 px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-bold text-teal-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => {
                      const updated = [...(formData.aboutUs?.stats || [
                        { value: "10K+", label: "Products" },
                        { value: "500+", label: "Sellers" },
                        { value: "50K+", label: "Happy Customers" },
                        { value: "24/7", label: "Support" },
                      ])];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, stats: updated } }));
                    }}
                    placeholder="Label (e.g. Products)"
                    className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded text-xs text-neutral-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (formData.aboutUs?.stats || [
                        { value: "10K+", label: "Products" },
                        { value: "500+", label: "Sellers" },
                        { value: "50K+", label: "Happy Customers" },
                        { value: "24/7", label: "Support" },
                      ]).filter((_, i) => i !== idx);
                      setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, stats: updated } }));
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Why Choose Us Cards Manager */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-neutral-700">Why Choose Us Cards</label>
              <button
                type="button"
                onClick={() => {
                  const currentItems = formData.aboutUs?.whyChooseUs || [
                    { title: "Fast Delivery", description: "Get your orders delivered at lightning speed with our efficient delivery network." },
                    { title: "Secure Payments", description: "Your transactions are protected with industry-standard encryption and security." },
                    { title: "Quality Products", description: "We partner with trusted sellers to ensure you receive only the best quality products." },
                    { title: "24/7 Support", description: "Our dedicated support team is always ready to help you with any queries." },
                  ];
                  setFormData((prev) => ({
                    ...prev,
                    aboutUs: {
                      ...prev.aboutUs,
                      whyChooseUs: [...currentItems, { title: '', description: '' }],
                    },
                  }));
                }}
                className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold rounded-lg border border-teal-200 transition-colors cursor-pointer"
              >
                + Add Feature Card
              </button>
            </div>

            <div className="space-y-3">
              {(formData.aboutUs?.whyChooseUs || [
                { title: "Fast Delivery", description: "Get your orders delivered at lightning speed with our efficient delivery network." },
                { title: "Secure Payments", description: "Your transactions are protected with industry-standard encryption and security." },
                { title: "Quality Products", description: "We partner with trusted sellers to ensure you receive only the best quality products." },
                { title: "24/7 Support", description: "Our dedicated support team is always ready to help you with any queries." },
              ]).map((item, idx) => (
                <div key={idx} className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...(formData.aboutUs?.whyChooseUs || [
                          { title: "Fast Delivery", description: "Get your orders delivered at lightning speed with our efficient delivery network." },
                          { title: "Secure Payments", description: "Your transactions are protected with industry-standard encryption and security." },
                          { title: "Quality Products", description: "We partner with trusted sellers to ensure you receive only the best quality products." },
                          { title: "24/7 Support", description: "Our dedicated support team is always ready to help you with any queries." },
                        ])];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, whyChooseUs: updated } }));
                      }}
                      placeholder="Title (e.g. Fast Delivery)"
                      className="w-full max-w-sm px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-bold text-neutral-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (formData.aboutUs?.whyChooseUs || [
                          { title: "Fast Delivery", description: "Get your orders delivered at lightning speed with our efficient delivery network." },
                          { title: "Secure Payments", description: "Your transactions are protected with industry-standard encryption and security." },
                          { title: "Quality Products", description: "We partner with trusted sellers to ensure you receive only the best quality products." },
                          { title: "24/7 Support", description: "Our dedicated support team is always ready to help you with any queries." },
                        ]).filter((_, i) => i !== idx);
                        setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, whyChooseUs: updated } }));
                      }}
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors font-medium"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...(formData.aboutUs?.whyChooseUs || [
                        { title: "Fast Delivery", description: "Get your orders delivered at lightning speed with our efficient delivery network." },
                        { title: "Secure Payments", description: "Your transactions are protected with industry-standard encryption and security." },
                        { title: "Quality Products", description: "We partner with trusted sellers to ensure you receive only the best quality products." },
                        { title: "24/7 Support", description: "Our dedicated support team is always ready to help you with any queries." },
                      ])];
                      updated[idx] = { ...updated[idx], description: e.target.value };
                      setFormData((prev) => ({ ...prev, aboutUs: { ...prev.aboutUs, whyChooseUs: updated } }));
                    }}
                    placeholder="Description..."
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving Changes...' : 'Save All Changes'}
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Disabling a Channel */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{confirmModal.title}</h3>
            </div>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-500">
              ℹ️ Existing customer orders already placed will continue fulfillment normally without interruption.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={updatingChannel}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.channel === 'QUICK_COMMERCE') {
                    applyChannelUpdate({
                      quickCommerceEnabled: false,
                      ecommerceEnabled: formData.commerceChannels?.ecommerceEnabled !== false,
                    });
                  } else {
                    applyChannelUpdate({
                      quickCommerceEnabled: formData.commerceChannels?.quickCommerceEnabled !== false,
                      ecommerceEnabled: false,
                    });
                  }
                }}
                disabled={updatingChannel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                {updatingChannel ? 'Updating...' : `Disable ${confirmModal.channel === 'QUICK_COMMERCE' ? 'Quick Commerce' : 'E-Commerce'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
