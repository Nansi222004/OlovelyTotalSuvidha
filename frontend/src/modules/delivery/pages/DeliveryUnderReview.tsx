import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getDeliveryProfile } from '../../../services/api/auth/deliveryAuthService';

export default function DeliveryUnderReview() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) {
      setChecking(true);
      setStatusMessage(null);
    }

    try {
      const res = await getDeliveryProfile();
      if (!isMountedRef.current) return;

      const updatedStatus = res?.data?.status;

      if (updatedStatus === 'Active') {
        // Update user state in auth context
        const updatedUser = {
          ...user,
          ...res.data,
          status: 'Active',
          userType: 'Delivery',
        };
        updateUser(updatedUser);
        // Automatically unlock and navigate to delivery dashboard
        navigate('/delivery', { replace: true });
        return;
      } else {
        if (isManual) {
          setStatusMessage('Your application is currently under review by our admin team.');
        }
      }
    } catch (err: any) {
      if (isManual && isMountedRef.current) {
        setStatusMessage(err.response?.data?.message || 'Unable to refresh status. Please try again.');
      }
    } finally {
      if (isManual && isMountedRef.current) {
        setChecking(false);
      }
    }
  }, [navigate, updateUser, user]);

  // Initial check on mount + FCM Token Registration + 30-second periodic background revalidation
  useEffect(() => {
    isMountedRef.current = true;
    checkStatus(false);

    // Register Web Push FCM token so browser receives push notifications
    import('../../../services/pushNotificationService').then(
      ({ registerFCMToken, setupForegroundNotificationHandler }) => {
        registerFCMToken(true).catch((err) => {
          console.log('FCM registration info:', err?.message);
        });

        // Setup live foreground push notification receiver
        setupForegroundNotificationHandler((payload) => {
          if (payload?.data?.type === 'ACCOUNT_APPROVED' || payload?.notification?.title?.includes('Activated') || payload?.notification?.title?.includes('Approved')) {
            checkStatus(false);
          }
        });
      }
    );

    const intervalId = setInterval(() => {
      checkStatus(false);
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [checkStatus]);

  const handleLogout = () => {
    logout();
    navigate('/delivery/login', { replace: true });
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-x-hidden overflow-y-auto px-4 py-8 select-none bg-slate-50"
      style={{ minHeight: '100vh', boxSizing: 'border-box' }}
    >
      {/* Background Soft Glow Blobs */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: '#0D9488' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: '#059669' }}
      />

      {/* Top Brand Logo */}
      <div className="relative z-10 flex flex-col items-center pt-2 pb-4">
        <div className="mb-2 transition-transform duration-200 hover:scale-[1.02]">
          <img
            src="/assets/olovelylogo_transparent.png"
            alt="Olovely Total Suvidha"
            className="w-32 sm:w-36 h-auto max-h-14 object-contain mx-auto"
          />
        </div>
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Olovely Delivery Partner
        </h1>
      </div>

      {/* Main Review Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/80 border border-slate-100 relative z-10 text-center my-auto">
        {/* Status Illustration Icon */}
        <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center text-teal-600 shadow-inner animate-pulse">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* Title and Message */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          Your Application Is Under Review
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 font-normal">
          Thank you for applying as an Olovely Delivery Partner. Our team is reviewing your application. Delivery operations will become available once your account is approved.
        </p>

        {/* Application Details Summary */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 text-left mb-6 space-y-2.5 text-xs sm:text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Partner Name:</span>
            <span className="font-semibold text-slate-800">{user?.name || 'Delivery Partner'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Registered Mobile:</span>
            <span className="font-semibold text-slate-800">+91 {user?.mobile || user?.phone || '—'}</span>
          </div>
          {user?.city && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">City:</span>
              <span className="font-semibold text-slate-800">{user.city}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium">Account Status:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Pending Approval
            </span>
          </div>
        </div>

        {/* Status Message / Notification */}
        {statusMessage && (
          <div className="mb-4 text-xs font-medium p-2.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 animate-fadeIn">
            {statusMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => checkStatus(true)}
            disabled={checking}
            className="w-full h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white shadow-md shadow-teal-900/20 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75"
          >
            {checking ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking Status...
              </>
            ) : (
              'Check Status'
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full h-10 rounded-xl font-semibold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-xs text-slate-500 pt-4">
        Need assistance? Contact{' '}
        <span className="text-teal-700 font-medium hover:underline cursor-pointer">
          support@olovely.com
        </span>
      </div>
    </div>
  );
}
