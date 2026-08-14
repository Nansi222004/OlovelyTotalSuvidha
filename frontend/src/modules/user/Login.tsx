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
      className="min-h-screen flex flex-col justify-between relative overflow-hidden px-4 py-5 sm:px-6 sm:py-8"
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Image Layer (Grocery Products Pattern) */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-20 transform scale-105"
        style={{
          backgroundImage: 'url(/assets/login_background_mobile.jfif)',
          filter: 'saturate(1.2)',
        }}
      />

      {/* Vibrant Gradient & Ambient Color Overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(165deg, rgba(14, 46, 114, 0.92) 0%, rgba(25, 118, 210, 0.85) 45%, rgba(16, 149, 67, 0.92) 100%)',
        }}
      />

      {/* Subtle Glowing Background Orbs */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: '#F59E0B' }}
      />
      <div
        className="absolute top-1/3 -left-20 w-72 h-72 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: '#38BDF8' }}
      />
      <div
        className="absolute bottom-10 right-0 w-64 h-64 rounded-full pointer-events-none opacity-25 blur-3xl"
        style={{ background: '#22C55E' }}
      />

      {/* Top Bar / Back Button */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all shadow-md"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Center Branding Section */}
      <div className="flex flex-col items-center justify-center text-center my-auto py-4 relative z-10">
        {/* Logo Card with Colorful Gradient Glow Border */}
        <div className="p-[2.5px] rounded-3xl bg-gradient-to-tr from-amber-400 via-white to-blue-400 shadow-2xl shadow-black/30 inline-flex items-center justify-center mb-3 sm:mb-4 transition-transform duration-300 hover:scale-[1.03]">
          <div className="bg-white rounded-[22px] px-4 py-2.5 sm:px-6 sm:py-3 shadow-inner flex items-center justify-center">
            <img
              src="/assets/olovelylogo_transparent.png"
              alt="Olovely Total Suvidha"
              className="w-44 sm:w-52 h-auto max-h-24 sm:max-h-28 object-contain mx-auto"
            />
          </div>
        </div>

        {/* Brand Tagline & Delivery Highlights */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
            India's Total Suvidha
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 font-medium tracking-wide">
            Fast grocery & daily essentials delivery
          </p>

          {/* Quick Feature Badges */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md text-amber-200 border border-white/20 shadow-sm">
              ⚡ Superfast
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md text-emerald-200 border border-white/20 shadow-sm">
              🛡️ Best Prices
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md text-sky-200 border border-white/20 shadow-sm">
              📦 All Essentials
            </span>
          </div>
        </div>
      </div>

      {/* Glassmorphic Login Card */}
      <div
        className="w-full max-w-md mx-auto rounded-[20px] p-5 sm:p-6 shadow-2xl relative z-10 backdrop-blur-md mt-auto"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.7)',
          boxShadow: '0 20px 40px -15px rgba(18, 59, 142, 0.35)',
        }}
      >
        {!showOTP ? (
          <>
            {/* Mobile Number Input */}
            <div className="w-full mb-3.5">
              <label className="block text-xs font-bold text-neutral-800 mb-1.5 text-left uppercase tracking-wider">
                Log in or sign up
              </label>
              <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl overflow-hidden focus-within:border-[#123B8E] focus-within:ring-2 focus-within:ring-[#123B8E]/20 transition-all shadow-sm">
                <div className="px-3.5 py-3 text-sm font-bold text-neutral-700 border-r border-[#E2E8F0] bg-neutral-50 flex items-center gap-1.5 select-none">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter mobile number"
                  className="flex-1 px-3.5 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none bg-white font-semibold"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="w-full mb-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg text-center">
                {error}
              </div>
            )}

            {/* Continue Button */}
            <div className="w-full mb-3">
              <button
                onClick={handleContinue}
                disabled={mobileNumber.length !== 10 || loading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] ${
                  mobileNumber.length === 10 && !loading
                    ? 'text-white shadow-blue-900/20 hover:brightness-110 cursor-pointer'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                }`}
                style={
                  mobileNumber.length === 10 && !loading
                    ? { background: 'linear-gradient(135deg, #123B8E, #1976D2)' }
                    : undefined
                }
              >
                {loading ? 'Sending OTP...' : 'Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* OTP Verification */}
            <div className="w-full mb-3 text-center">
              <p className="text-xs text-neutral-600 mb-1">
                Enter the 4-digit OTP sent to
              </p>
              <p className="text-base font-bold text-[#123B8E]">+91 {mobileNumber}</p>
            </div>
            <div className="w-full mb-3.5 flex justify-center">
              <OTPInput onComplete={handleOTPComplete} disabled={loading} />
            </div>
            {error && (
              <div className="w-full mb-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg text-center">
                {error}
              </div>
            )}
            <div className="w-full mb-3 flex gap-2">
              <button
                onClick={() => {
                  setShowOTP(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-200"
              >
                Change Number
              </button>
              <button
                onClick={handleContinue}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-blue-50 text-[#123B8E] border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                {loading ? 'Verifying...' : 'Resend OTP'}
              </button>
            </div>
          </>
        )}

        {/* Terms & Privacy Note */}
        <p className="text-[11px] text-neutral-500 text-center leading-relaxed pt-3 border-t border-neutral-100 mt-1">
          By continuing, you agree to Olovely Total Suvidha's{' '}
          <span className="text-[#123B8E] font-medium hover:underline cursor-pointer">Terms of Service</span> &{' '}
          <span className="text-[#123B8E] font-medium hover:underline cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}


