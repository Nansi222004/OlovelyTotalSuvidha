import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProfile, CustomerProfile } from '../../services/api/customerService';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout: authLogout } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getProfile();
        if (response.success) {
          setProfile(response.data);
        } else {
          setError('Failed to load profile');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load profile');
        if (err.response?.status === 401) {
          authLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user, navigate, authLogout]);

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
              <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">Welcome!</h1>
              <p className="text-sm md:text-base text-neutral-600 text-center px-4">
                Login to access your profile, orders, and more
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
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-teal-600 text-white rounded">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || 'User';
  const displayPhone = profile?.phone || user?.phone || '';
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
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">{displayName}</h1>
            <div className="flex flex-col items-center gap-1.5 md:gap-2 text-xs md:text-sm text-neutral-600">
              {displayPhone && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{displayPhone}</span>
                </div>
              )}
              {displayDateOfBirth && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <span>{formatDate(displayDateOfBirth)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 -mt-4 md:-mt-6 mb-4 md:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-2.5 md:gap-6 max-w-2xl md:mx-auto">
          <button onClick={() => navigate('/orders')} className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">Your orders</div>
          </button>
          <button onClick={() => navigate('/notifications')} className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">Notifications</div>
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">Need help?</div>
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5">
        <h2 className="text-xs font-bold text-neutral-900 mb-2 uppercase tracking-wide">Your information</h2>
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
          <button onClick={() => navigate('/address-book')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">Address Book</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/wishlist')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">Your Wishlist</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/account/wallet')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-emerald-600"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">My Wallet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ₹{(profile?.walletAmount || 0).toFixed(2)}
              </span>
              <span className="text-neutral-400">›</span>
            </div>
          </button>
          <button onClick={() => navigate('/privacy-policy')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">Privacy & Terms Policy</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/about-us')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-500"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" /></svg>
              <span className="text-[13px] font-medium text-neutral-900">About Us</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-red-500"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-[13px] font-medium text-red-500">Log Out</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
