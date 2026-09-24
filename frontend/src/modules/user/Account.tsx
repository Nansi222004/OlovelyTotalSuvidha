import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile, CustomerProfile } from '../../services/api/customerService';
import LanguageSelector from '../../components/LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';

const isPlaceholderName = (val?: string): boolean => !val || val.trim().toLowerCase() === 'user';
const resolveEffectiveName = (profileName?: string, authName?: string): string => {
  if (!isPlaceholderName(profileName)) return profileName!.trim();
  if (!isPlaceholderName(authName)) return authName!.trim();
  return 'User';
};

export default function Account() {
  const navigate = useNavigate();
  const { user, updateUser, logout: authLogout } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Authoritative authenticated customer ID
  const customerId = user?.id || user?._id || '';

  // Stable reference to user to allow safe comparisons without triggering effect re-runs
  const userRef = useRef(user);
  userRef.current = user;

  // Active in-flight request controller to cancel stale requests and avoid race conditions
  const inFlightAbortRef = useRef<AbortController | null>(null);

  const loadProfile = useCallback(
    async (isInitial = false) => {
      if (!customerId) {
        setLoading(false);
        return;
      }

      // Abort any existing in-flight request before launching a new one
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
      const abortController = new AbortController();
      inFlightAbortRef.current = abortController;

      // Show full loading spinner ONLY during initial profile fetch (when profile is not loaded yet)
      if (isInitial || !profile) {
        setLoading(true);
      }
      setError('');

      try {
        const response = await getProfile({ signal: abortController.signal });
        if (abortController.signal.aborted) return;

        if (response && response.success && response.data) {
          setProfile(response.data);

          // Safely synchronize AuthContext with latest profile from backend if changed
          if (updateUser) {
            const currentUser = userRef.current;
            const safeName = resolveEffectiveName(response.data.name, currentUser?.name);
            const safeUser: any = {
              ...currentUser,
              id: response.data.id || (response.data as any)._id || customerId,
              _id: response.data.id || (response.data as any)._id || customerId,
              name: safeName,
              phone: response.data.phone || currentUser?.phone,
              email: response.data.email !== undefined ? response.data.email : currentUser?.email,
              walletAmount:
                response.data.walletAmount !== undefined
                  ? response.data.walletAmount
                  : currentUser?.walletAmount,
              refCode: response.data.refCode || currentUser?.refCode,
              status: response.data.status || currentUser?.status,
              userType: currentUser?.userType || 'Customer',
            };

            // Only update if there is a genuine field difference to prevent infinite loops
            const hasChanges =
              !currentUser ||
              currentUser.name !== safeUser.name ||
              currentUser.phone !== safeUser.phone ||
              currentUser.email !== safeUser.email ||
              currentUser.walletAmount !== safeUser.walletAmount ||
              currentUser.refCode !== safeUser.refCode ||
              currentUser.status !== safeUser.status ||
              (currentUser.id || currentUser._id) !== (safeUser.id || safeUser._id);

            if (hasChanges) {
              updateUser(safeUser);
            }
          }
        } else {
          setError('Failed to load profile');
        }
      } catch (err: any) {
        // Ignore aborted requests cleanly
        if (
          abortController.signal.aborted ||
          err?.name === 'CanceledError' ||
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED'
        ) {
          return;
        }
        setError(err.response?.data?.message || 'Failed to load profile');
        if (err.response?.status === 401) {
          authLogout();
        }
      } finally {
        if (inFlightAbortRef.current === abortController) {
          inFlightAbortRef.current = null;
          setLoading(false);
        }
      }
    },
    [customerId, updateUser, authLogout]
  );

  useEffect(() => {
    if (customerId) {
      loadProfile(true);
    } else {
      setLoading(false);
    }

    return () => {
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
        inFlightAbortRef.current = null;
      }
    };
  }, [customerId, loadProfile]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  const handleOpenEditModal = () => {
    const rawEmail = profile?.email || user?.email || '';
    // Hide placeholder @olovely.temp from customer-facing UI
    const sanitizedEmail = rawEmail.endsWith('@olovely.temp') ? '' : rawEmail;
    const currentName = (profile?.name || user?.name || '').trim();

    setEditFormData({
      name: currentName.toLowerCase() === 'user' ? '' : currentName,
      email: sanitizedEmail,
    });
    setEditError(null);
    setEditSuccessMessage(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editFormData.name.trim();
    const trimmedEmail = editFormData.email.trim();

    if (!trimmedName) {
      setEditError(t('account.nameRequired', 'Full name is required'));
      return;
    }

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setEditError(t('account.invalidEmail', 'Please enter a valid email address'));
        return;
      }
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const payload: { name: string; email?: string } = { name: trimmedName };
      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }

      const response = await updateProfile(payload);
      if (response && response.success && response.data) {
        const updatedProfile = response.data;
        // 1. Update component profile state
        setProfile(updatedProfile);

        // 2. Update AuthContext without losing existing session fields
        if (updateUser) {
          const safeUser: any = {
            ...user,
            id: updatedProfile.id || (updatedProfile as any)._id || user?.id,
            _id: updatedProfile.id || (updatedProfile as any)._id || user?.id,
            name: updatedProfile.name || trimmedName,
            phone: updatedProfile.phone || user?.phone,
            email: updatedProfile.email !== undefined ? updatedProfile.email : user?.email,
            walletAmount: updatedProfile.walletAmount !== undefined ? updatedProfile.walletAmount : user?.walletAmount,
            refCode: updatedProfile.refCode || user?.refCode,
            status: updatedProfile.status || user?.status,
            userType: user?.userType || 'Customer',
          };
          updateUser(safeUser);
        }

        setEditSuccessMessage(t('account.profileUpdated', 'Profile updated successfully!'));
        setTimeout(() => {
          setIsEditModalOpen(false);
          setEditSuccessMessage(null);
        }, 700);
      } else {
        setEditError(response?.message || 'Failed to update profile');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile. Please try again.';
      setEditError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Show login/signup prompt for unregistered users
  if (!user) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen">
        <div className="bg-gradient-to-b from-green-200 via-green-100 to-white pb-6 md:pb-8 pt-12 md:pt-16">
          <div className="px-4 md:px-6 lg:px-8">
            <button onClick={() => navigate(-1)} className="mb-4 text-neutral-900" aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="flex flex-col items-center mb-4 md:mb-6">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neutral-200 flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-neutral-500 md:w-12 md:h-12">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">{t("account.welcome", "Welcome!")}</h1>
              <p className="text-sm md:text-base text-neutral-600 text-center px-4">
                {t("account.loginPrompt", "Login to access your profile, orders, and more")}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 mt-6">
          <div className="max-w-md mx-auto space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 rounded-lg font-semibold text-base bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
            >
              {t("common.login", "Login")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">{t("account.loadingProfile", "Loading profile...")}</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center px-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 text-red-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadProfile(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-sm transition-colors"
            >
              {t("common.retry", "Retry")}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg transition-colors"
            >
              {t("common.back", "Go Back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = resolveEffectiveName(profile?.name, user?.name);
  const displayPhone = profile?.phone || user?.phone || '';
  const rawEmail = profile?.email || user?.email || '';
  const displayEmail = rawEmail.endsWith('@olovely.temp') ? '' : rawEmail;
  const displayDateOfBirth = profile?.dateOfBirth;

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      <div className="bg-gradient-to-b from-green-200 via-green-100 to-white pb-6 md:pb-8 pt-12 md:pt-16">
        <div className="px-4 md:px-6 lg:px-8">
          <button onClick={() => navigate(-1)} className="mb-4 text-neutral-900" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center mb-4 md:mb-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neutral-200 flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-neutral-500 md:w-12 md:h-12">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-1">{displayName}</h1>
            
            <div className="flex flex-col items-center gap-1.5 md:gap-2 text-xs md:text-sm text-neutral-600">
              {displayPhone && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{displayPhone}</span>
                </div>
              )}
              {displayEmail && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <span>{displayEmail}</span>
                </div>
              )}
              {displayDateOfBirth && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <span>{formatDate(displayDateOfBirth)}</span>
                </div>
              )}
            </div>

            {/* Edit Profile Button in Header */}
            <button
              onClick={handleOpenEditModal}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/90 hover:bg-white text-emerald-800 border border-emerald-300 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              {t("account.editProfile", "Edit Profile")}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 -mt-4 md:-mt-6 mb-4 md:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-2.5 md:gap-6 max-w-2xl md:mx-auto">
          <button onClick={() => navigate('/orders')} className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">{t("account.yourOrders", "Your orders")}</div>
          </button>
          <button onClick={() => navigate('/notifications')} className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">{t("account.notifications", "Notifications")}</div>
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">{t("account.needHelp", "Need help?")}</div>
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5">
        <h2 className="text-xs font-bold text-neutral-900 mb-2 uppercase tracking-wide">{t("account.yourInformation", "Your information")}</h2>
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
          {/* Edit Profile / Personal Details Row */}
          <button onClick={handleOpenEditModal} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.personalDetails", "Personal Details / Edit Profile")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500">{displayName !== 'User' ? displayName : ''}</span>
              <span className="text-neutral-400">›</span>
            </div>
          </button>

          {/* Language Selection Row */}
          <div className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg">🌐</span>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.appLanguage", "App Language / भाषा")}</span>
            </div>
            <LanguageSelector variant="dropdown" />
          </div>

          <button onClick={() => navigate('/address-book')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.addressBook", "Address Book")}</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/wishlist')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.yourWishlist", "Your Wishlist")}</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/account/wallet')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-emerald-600"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.myWallet", "My Wallet")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ₹{(profile?.walletAmount || 0).toFixed(2)}
              </span>
              <span className="text-neutral-400">›</span>
            </div>
          </button>
          <button onClick={() => navigate('/privacy-policy')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.privacyPolicy", "Privacy & Terms Policy")}</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/about-us')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">{t("account.aboutUs", "About Us")}</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-red-500"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-[13px] font-medium text-red-500">{t("account.logOut", "Log Out")}</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !isSaving && setIsEditModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-neutral-100"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">
                    {t("account.editProfileTitle", "Edit Profile")}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {t("account.editProfileSubtitle", "Update your personal details below")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isSaving && setIsEditModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Registered Phone (Read-Only) */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {t("account.registeredPhone", "Registered Phone Number")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={displayPhone}
                      disabled
                      readOnly
                      className="w-full px-3 py-2.5 text-sm bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 font-medium cursor-not-allowed select-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Phone number is linked to your OTP authentication.
                  </p>
                </div>

                {/* Full Name (Required) */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {t("account.fullName", "Full Name")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    disabled={isSaving}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Email Address (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {t("account.emailAddress", "Email Address")}{" "}
                    <span className="text-neutral-400 font-normal">({t("common.optional", "Optional")})</span>
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email (optional)"
                    disabled={isSaving}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Used for order receipts and notifications if provided.
                  </p>
                </div>

                {editError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>{editError}</span>
                  </div>
                )}

                {editSuccessMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>{editSuccessMessage}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isSaving}
                    className="flex-1 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !editFormData.name.trim()}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSaving || !editFormData.name.trim()
                        ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-98"
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      t("common.save", "Save Changes")
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
