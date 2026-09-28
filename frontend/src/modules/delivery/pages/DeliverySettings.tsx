import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { updateSettings, getDeliveryProfile, deleteDeliveryAccount } from '../../../services/api/delivery/deliveryService';
import { clearDeliverySession } from '../../../services/api/config';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import ConfirmationModal from '../../../components/ConfirmationModal';
import LanguageSelector from '../../../components/LanguageSelector';

export default function DeliverySettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showLangModal, setShowLangModal] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const profile = await getDeliveryProfile();
        if (profile.settings) {
          setNotificationsEnabled(profile.settings.notifications ?? true);
          setLocationEnabled(profile.settings.location ?? true);
          setSoundEnabled(profile.settings.sound ?? true);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSettingChange = async (key: string, value: boolean) => {
    // Optimistic update
    if (key === 'notifications') setNotificationsEnabled(value);
    if (key === 'location') setLocationEnabled(value);
    if (key === 'sound') setSoundEnabled(value);

    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error("Failed to update settings", error);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await deleteDeliveryAccount();
      if (res && res.success) {
        setIsDeleteModalOpen(false);
        clearDeliverySession();
        logout();
        showToast(res.message || "Your delivery partner account has been deleted. You have been logged out.", "success");
        navigate('/delivery/login', { replace: true });
      } else {
        showToast(res?.message || "Failed to delete account", "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete account";
      showToast(msg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const settingsOptions = [
    {
      id: 'notifications',
      title: t("account.notifications", "Push Notifications"),
      description: t("delivery.newOrder", "Receive notifications for new orders"),
      value: notificationsEnabled,
      onChange: (val: boolean) => handleSettingChange('notifications', val),
    },
    {
      id: 'location',
      title: t("delivery.currentLocation", "Location Services"),
      description: t("delivery.locationAccessRequired", "Allow app to access your location"),
      value: locationEnabled,
      onChange: (val: boolean) => handleSettingChange('location', val),
    },
    {
      id: 'sound',
      title: t("delivery.notifications", "Sound Alerts"),
      description: t("delivery.newOrder", "Play sound for new order alerts"),
      value: soundEnabled,
      onChange: (val: boolean) => handleSettingChange('sound', val),
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">{t("delivery.settings", "Settings")}</h2>
        </div>

        {/* Settings Options */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden mb-4">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">{t("common.settings", "Preferences")}</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            {settingsOptions.map((option) => (
              <div key={option.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-neutral-900 text-sm font-medium mb-1">{option.title}</p>
                  <p className="text-neutral-500 text-xs">{option.description}</p>
                </div>
                <button
                  onClick={() => option.onChange(!option.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${option.value ? 'bg-orange-500' : 'bg-neutral-300'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${option.value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Other Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">Other</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            <button
              onClick={() => setShowLangModal(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="flex-1 text-left">
                <p className="text-neutral-900 text-sm font-medium">{t("common.language", "Language")}</p>
                <p className="text-neutral-500 text-xs mt-1 uppercase">
                  {language}
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>
            <button
              onClick={() => navigate('/delivery/privacy-policy')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="flex-1 text-left">
                <p className="text-neutral-900 text-sm font-medium">{t("common.privacyPolicy", "Privacy Policy")}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>
            <button
              onClick={() => navigate('/delivery/terms-and-conditions')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="flex-1 text-left">
                <p className="text-neutral-900 text-sm font-medium">{t("common.termsConditions", "Terms & Conditions")}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden mt-4">
          <div className="p-4 border-b border-red-100 bg-red-50/50">
            <h3 className="text-red-900 font-semibold text-sm">Danger Zone</h3>
          </div>
          <div className="p-4">
            <p className="text-xs text-neutral-600 mb-3 leading-relaxed">
              Permanently delete your delivery partner account. This action cannot be undone and will terminate all active deliveries, assignments, and location tracking.
            </p>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 5v6m4-6v6" />
              </svg>
              {t("delivery.deleteAccount", "Delete Delivery Account")}
            </button>
          </div>
        </div>

        {/* App Version */}
        <div className="mt-4 text-center">
          <p className="text-neutral-400 text-xs">App Version {appVersion}</p>
        </div>
      </div>

      {/* Language Selection Modal */}
      <LanguageSelector variant="modal" isOpen={showLangModal} onClose={() => setShowLangModal(false)} />

      {/* Confirmation Modal for Delete Account */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title={t("delivery.deleteModalTitle", "Delete your account?")}
        message={t(
          "delivery.deleteModalMessage",
          "This action will permanently delete your delivery partner account and you will be logged out. All GPS tracking and order assignments will be stopped immediately."
        )}
        confirmText={t("delivery.confirmDelete", "Delete Account")}
        cancelText={t("common.cancel", "Cancel")}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => !isDeleting && setIsDeleteModalOpen(false)}
      />

      <DeliveryBottomNav />
    </div>
  );
}

