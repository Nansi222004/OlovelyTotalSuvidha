import React, { useState, useEffect } from 'react';
import { getAppSettings, updateAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';

export default function AdminWholesaleSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    wholesaleEnabled: false,
    defaultWholesaleMinimumQuantity: 10,
    wholesaleDisplayEnabled: true,
    lowStockThreshold: 10,
    lowStockDisplayQuantity: 2,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getAppSettings();
      if (res && res.success && res.data) {
        const ws = res.data.wholesaleSettings;
        const inv = res.data.inventorySettings;
        setFormData({
          wholesaleEnabled: ws?.wholesaleEnabled ?? false,
          defaultWholesaleMinimumQuantity: ws?.defaultWholesaleMinimumQuantity ?? 10,
          wholesaleDisplayEnabled: ws?.wholesaleDisplayEnabled ?? true,
          lowStockThreshold: inv?.lowStockThreshold ?? 10,
          lowStockDisplayQuantity: inv?.lowStockDisplayQuantity ?? 2,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');

      const payload = {
        wholesaleSettings: {
          wholesaleEnabled: formData.wholesaleEnabled,
          defaultWholesaleMinimumQuantity: Math.max(1, Number(formData.defaultWholesaleMinimumQuantity) || 1),
          wholesaleDisplayEnabled: formData.wholesaleDisplayEnabled,
        },
        inventorySettings: {
          lowStockThreshold: Math.max(0, Number(formData.lowStockThreshold) || 0),
          lowStockDisplayQuantity: Math.max(1, Number(formData.lowStockDisplayQuantity) || 1),
        },
      };

      const res = await updateAppSettings(payload as Partial<AppSettings>);
      if (res && res.success) {
        setSuccessMessage('Wholesale and Inventory settings updated successfully!');
        window.dispatchEvent(new CustomEvent('appSettingsUpdated'));
      } else {
        setErrorMessage(res?.message || 'Failed to update settings');
      }
    } catch (err: any) {
      console.error('Save wholesale settings error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setErrorMessage('Admin session expired or unauthorized. Please log in as Admin.');
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Wholesale & Inventory Settings</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Configure platform-wide wholesale commerce capabilities, default MOQs, and inventory alert thresholds.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Wholesale Capability Section */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
              🏷️
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Wholesale Commercial Capability</h2>
              <p className="text-xs text-neutral-500">
                Four-layer gating hierarchy (Global &gt; Seller &gt; Category &gt; Product)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Global Wholesale Toggle */}
            <div className="flex items-start justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="space-y-1 pr-4">
                <label htmlFor="wholesaleEnabled" className="text-sm font-semibold text-neutral-900 cursor-pointer">
                  Global Wholesale Enabled
                </label>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Master on/off switch for the wholesale channel platform-wide. When disabled, wholesale order creation and wholesale customer mode are blocked regardless of seller or product settings.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  id="wholesaleEnabled"
                  checked={formData.wholesaleEnabled}
                  onChange={(e) => setFormData({ ...formData, wholesaleEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* Wholesale Display Enabled Toggle */}
            <div className="flex items-start justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="space-y-1 pr-4">
                <label htmlFor="wholesaleDisplayEnabled" className="text-sm font-semibold text-neutral-900 cursor-pointer">
                  Wholesale Display Enabled
                </label>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Controls whether the Wholesale shopping mode toggle and promotional Wholesale badges are visible to customers on the storefront.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  id="wholesaleDisplayEnabled"
                  checked={formData.wholesaleDisplayEnabled}
                  onChange={(e) => setFormData({ ...formData, wholesaleDisplayEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* Default Wholesale MOQ */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Default Wholesale Minimum Quantity (MOQ)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.defaultWholesaleMinimumQuantity}
                onChange={(e) => setFormData({ ...formData, defaultWholesaleMinimumQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full sm:w-64 px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">
                Pre-fill default for NEW wholesale product configuration. Does NOT rewrite existing product MOQ values.
              </p>
            </div>
          </div>
        </div>

        {/* Inventory & Stock Alert Section */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              📦
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Inventory & Low-Stock Alerts</h2>
              <p className="text-xs text-neutral-500">
                Dynamic customer-facing stock warning thresholds loaded from server configuration
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">
                Stock level at or below which the "low stock" badge and warning is shown to customers.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Low Stock Display Quantity
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.lowStockDisplayQuantity}
                onChange={(e) => setFormData({ ...formData, lowStockDisplayQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">
                Display quantity template: &quot;Only &#123;quantity&#125; items left&quot;.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
