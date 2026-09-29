import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../../services/api/auth/deliveryAuthService';
import OTPInput from '../../../components/OTPInput';
import { useAuth } from '../../../context/AuthContext';
import { removeAuthToken, getAuthToken } from '../../../services/api/config';
import deliveryLogo from '@assets/delivery_logo.jpg';

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [sessionNotice] = useState<string | null>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const notice = sessionStorage.getItem('delivery_session_notice');
      if (notice) {
        sessionStorage.removeItem('delivery_session_notice');
        return notice;
      }
    }
    return (location.state as any)?.sessionExpiredMessage || null;
  });

  // Clear token on mount only if unauthenticated
  useEffect(() => {
    if (!getAuthToken('delivery')) {
      removeAuthToken('delivery');
    }
  }, []);

  const handleMobileLogin = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError('');
    setIsNotRegistered(false);

    try {
      const response = await sendOTP(mobileNumber);
      if (response.success && response.sessionId) {
        setSessionId(response.sessionId);
        setShowOTP(true);
      } else {
        setError(response.message || 'Failed to initiate OTP');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to send OTP. Please try again.';

      setError(message);

      // Check for 400 Bad Request specific to user not found (or based on message content)
      if (status === 400 && (message.toLowerCase().includes('not found') || message.toLowerCase().includes('register'))) {
        setIsNotRegistered(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(mobileNumber, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context
        login(response.data.token, {
          ...response.data.user,
          userType: 'Delivery'
        });
        const from = (location.state as any)?.from?.pathname || (location.state as any)?.from || '/delivery';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      // Also handle 401 Unauthorized for verify step
      const message = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-50 flex flex-col items-center justify-center px-4 py-8 delivery-app-root">
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

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <div className="px-6 py-4 text-center border-b border-green-700 bg-white">
          <div className="mb-2">
            <img
              src={deliveryLogo}
              alt="Olovely Total Suvidha"
              className="h-24 w-auto max-w-xs mx-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Delivery Login</h1>
          <p className="text-neutral-600 text-sm">Access your Olovely delivery dashboard</p>
        </div>

        {/* Login Form */}
        <div className="p-6 space-y-4">
          {!showOTP ? (
            /* Mobile Login Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Mobile Number
                </label>
                <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200 transition-all">
                  <div className="px-3 py-2.5 text-sm font-medium text-neutral-600 border-r border-neutral-300 bg-neutral-50">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter mobile number"
                    className="flex-1 px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none"
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
              </div>

              {sessionNotice && !error && (
                <div className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{sessionNotice}</span>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100 flex flex-col gap-2">
                  <span>{error}</span>
                  {isNotRegistered && (
                    <button
                      onClick={() => navigate('/delivery/signup')}
                      className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 py-1.5 px-3 rounded self-start transition-colors"
                    >
                      Register Now
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleMobileLogin}
                disabled={mobileNumber.length !== 10 || loading}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${mobileNumber.length === 10 && !loading
                  ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                  : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  }`}
              >
                {loading ? 'Sending...' : 'Continue'}
              </button>
            </div>
          ) : (
            /* OTP Verification Form */
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-2">
                  Enter the 4-digit OTP sent to
                </p>
                <p className="text-sm font-semibold text-neutral-800">+91 {mobileNumber}</p>
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
                  Change Number
                </button>
                <button
                  onClick={handleMobileLogin}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  {loading ? 'Verifying...' : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}



          {/* Sign Up Link */}
          <div className="text-center pt-4 border-t border-neutral-200">
            <p className="text-sm text-neutral-600">
              Don't have a delivery partner account?{' '}
              <button
                onClick={() => navigate('/delivery/signup')}
                className="text-teal-600 hover:text-teal-700 font-semibold"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Text */}
      <p className="mt-6 text-xs text-neutral-500 text-center max-w-md">
        By continuing, you agree to Olovely's Terms of Service and Privacy Policy
      </p>
    </div>
  );
}

