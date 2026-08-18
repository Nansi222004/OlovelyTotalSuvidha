import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../services/api/auth/customerAuthService';
import { useAuth } from '../../context/AuthContext';
import OTPInput from '../../components/OTPInput';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError('');

    try {
      const response = await sendOTP(mobileNumber);
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      setShowOTP(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate call. Please try again.');
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
        // Update auth context with user data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.name,
          phone: response.data.user.phone,
          email: response.data.user.email,
          walletAmount: response.data.user.walletAmount,
          refCode: response.data.user.refCode,
          status: response.data.user.status,
        });
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 select-none bg-white"
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Subtle Soft Background Ambient Gradient Accents */}
      <div
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: '#EFF6FF' }}
      />
      <div
        className="absolute top-1/3 -left-20 w-72 h-72 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: '#F0FDF4' }}
      />
      <div
        className="absolute -bottom-10 right-4 w-72 h-72 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: '#FEF3C7' }}
      />

      {/* Top Bar / Clean Circular Back Button */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto flex items-center justify-between relative z-10 pt-1 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
          aria-label="Go back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Center Unified Content Container (Brand Header + Auth Card) */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center justify-center my-auto py-2 relative z-10">
        {/* Compact Olovely Branding Section */}
        <div className="flex flex-col items-center justify-center text-center mb-4 sm:mb-5">
          {/* Logo */}
          <div className="mb-2.5 transition-transform duration-200 hover:scale-[1.02]">
            <img
              src="/assets/olovelylogo_transparent.png"
              alt="Olovely Total Suvidha"
              className="w-32 sm:w-36 h-auto max-h-14 object-contain mx-auto"
            />
          </div>

          {/* Brand Tagline & Delivery Highlights */}
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              India's Total Suvidha
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
              Fast grocery & daily essentials delivery
            </p>

            {/* Quick Feature Badges (Lightweight Tinted Pills on White) */}
            <div className="flex items-center justify-center gap-2 pt-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                ⚡ Superfast
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                ₹ Best Prices
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shadow-2xs">
                ✓ All Essentials
              </span>
            </div>
          </div>
        </div>

        {/* Clean Modern Authentication Card */}
        <div
          className="w-full bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/80 border border-slate-100 relative z-10 transition-all"
        >
          {!showOTP ? (
            <>
              {/* Form Header */}
              <div className="mb-4 text-center">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Log in
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Enter your mobile number to continue
                </p>
              </div>

              {/* Mobile Number Input */}
              <div className="w-full mb-3.5">
                <div className="flex items-center h-12 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
                  {/* Country Code Block */}
                  <div className="w-[74px] h-full bg-slate-100/90 border-r border-slate-200/90 text-sm font-bold text-slate-700 flex items-center justify-center gap-1 select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  {/* Phone Input Field */}
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter mobile number"
                    className="flex-1 h-full px-3.5 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none bg-transparent"
                    maxLength={10}
                    disabled={loading}
                    autoFocus
                    id="customer-mobile-input"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="w-full mb-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200/80 p-2.5 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Prominent Full-Width Continue CTA */}
              <div className="w-full mb-2">
                <button
                  onClick={handleContinue}
                  disabled={mobileNumber.length !== 10 || loading}
                  id="customer-login-continue-btn"
                  className={`w-full h-12 rounded-xl font-semibold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] flex items-center justify-center ${
                    mobileNumber.length === 10 && !loading
                      ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-teal-600 hover:from-blue-800 hover:to-teal-700 text-white shadow-blue-900/20 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-white">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending OTP...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* OTP Verification Header */}
              <div className="w-full mb-4 text-center">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Verify Mobile Number
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Enter the 4-digit code sent to{' '}
                  <span className="font-bold text-blue-700">+91 {mobileNumber}</span>
                </p>
              </div>

              {/* OTP Input Fields */}
              <div className="w-full mb-4 flex justify-center">
                <OTPInput onComplete={handleOTPComplete} disabled={loading} />
              </div>

              {/* Error Message */}
              {error && (
                <div className="w-full mb-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200/80 p-2.5 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* OTP Action Buttons */}
              <div className="w-full mb-2 flex gap-2.5">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl font-semibold text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all border border-slate-200 cursor-pointer flex items-center justify-center"
                >
                  Change Number
                </button>
                <button
                  onClick={handleContinue}
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl font-semibold text-xs bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  {loading ? 'Verifying...' : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {/* Legal / Trust Copy */}
          <p className="text-[11px] text-slate-400 text-center leading-relaxed mt-4 pt-3 border-t border-slate-100">
            By continuing, you agree to Olovely Total Suvidha's{' '}
            <span className="text-blue-700 font-medium hover:underline cursor-pointer">Terms of Service</span> &{' '}
            <span className="text-blue-700 font-medium hover:underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>

      {/* Bottom Spacer for Perfect Vertical Alignment */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto h-2" />
    </div>
  );
}


