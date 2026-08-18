import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getSellerProfile } from '../../../services/api/auth/sellerAuthService';

export default function SellerUnderReview() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRejected, setIsRejected] = useState(user?.status === 'Rejected');
  const isMountedRef = useRef(true);

  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) {
      setChecking(true);
      setStatusMessage(null);
    }

    try {
      const res = await getSellerProfile();
      if (!isMountedRef.current) return;

      const updatedStatus = res?.data?.status;

      if (updatedStatus === 'Approved') {
        // Update user state in auth context
        const updatedUser = {
          ...user,
          ...res.data,
          status: 'Approved',
          userType: 'Seller',
        };
        updateUser(updatedUser);
        // Automatically unlock and navigate to dashboard
        navigate('/seller', { replace: true });
        return;
      } else if (updatedStatus === 'Rejected') {
        setIsRejected(true);
        if (isManual) {
          setStatusMessage('Your seller application was not approved. Please contact support.');
        }
      } else {
        setIsRejected(false);
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
          if (payload?.data?.type === 'ACCOUNT_APPROVED' || payload?.notification?.title?.includes('Approved')) {
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
    navigate('/seller/login', { replace: true });
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-x-hidden overflow-y-auto px-4 py-8 select-none bg-slate-50"
      style={{ minHeight: '100vh', boxSizing: 'border-box' }}
    >
      {/* Background Soft Glow Blobs */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: '#3B82F6' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: '#10B981' }}
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
          Olovely Seller Portal
        </h1>
      </div>

      {/* Main Review Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/80 border border-slate-100 relative z-10 text-center my-auto">
        {/* Status Illustration Icon */}
        <div className="mx-auto mb-5 w-20 h-20 rounded-full flex items-center justify-center shadow-inner relative">
          {isRejected ? (
            <div className="w-full h-full rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-500">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          ) : (
            <div className="w-full h-full rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-500 animate-pulse">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>

        {/* Title and Message */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          {isRejected ? 'Application Not Approved' : 'Your Account Is Under Review'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 font-normal">
          {isRejected
            ? 'Thank you for your interest in Olovely. Unfortunately, your seller application could not be approved at this time.'
            : "Thank you for registering with Olovely. Our team is reviewing your seller application. You'll be able to access your seller dashboard once your account is approved."}
        </p>

        {/* Application Details Summary */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 text-left mb-6 space-y-2.5 text-xs sm:text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Store Name:</span>
            <span className="font-semibold text-slate-800">{user?.storeName || user?.name || 'Your Store'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Registered Mobile:</span>
            <span className="font-semibold text-slate-800">+91 {user?.phone || user?.mobile || '—'}</span>
          </div>
          {user?.city && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">City / Area:</span>
              <span className="font-semibold text-slate-800">{user.city}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium">Application Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isRejected
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRejected ? 'bg-red-500' : 'bg-amber-500 animate-ping'}`} />
              {isRejected ? 'Rejected' : 'Pending Approval'}
            </span>
          </div>
        </div>

        {/* Status Message / Notification */}
        {statusMessage && (
          <div className="mb-4 text-xs font-medium p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 animate-fadeIn">
            {statusMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => checkStatus(true)}
            disabled={checking}
            className="w-full h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-700 via-blue-600 to-teal-600 hover:from-blue-800 hover:to-teal-700 text-white shadow-md shadow-blue-900/20 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75"
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
              'Check Approval Status'
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
        <span className="text-blue-700 font-medium hover:underline cursor-pointer">
          support@olovely.com
        </span>
      </div>
    </div>
  );
}
