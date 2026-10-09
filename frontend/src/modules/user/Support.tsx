import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { submitCustomerSupport } from '../../services/api/customerService';

export default function Support() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { settings: appSettings } = useAppSettings();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const isSellerSupport = location.pathname.startsWith('/seller/');
  const faqPath = isSellerSupport ? '/seller/faq' : '/faq';
  const policyPath = isSellerSupport ? '/seller/privacy-policy' : '/privacy-policy';

  // Auto-populate customer info if logged in
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Please enter a valid name (at least 2 characters)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!subject.trim() || subject.trim().length < 3) {
      newErrors.subject = 'Please enter a subject (at least 3 characters)';
    }

    if (!message.trim() || message.trim().length < 10) {
      newErrors.message = 'Please describe your inquiry or issue (at least 10 characters)';
    } else if (message.trim().length > 2000) {
      newErrors.message = 'Message cannot exceed 2000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await submitCustomerSupport({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });

      if (response.success) {
        showToast(
          response.message || 'Your support request has been submitted successfully.',
          'success'
        );
        setSubmitted(true);
        setSubject('');
        setMessage('');
        setErrors({});
      } else {
        showToast(response.message || 'Unable to submit your message. Please try again.', 'error');
      }
    } catch (err: any) {
      console.error('Support submit error:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to send your message right now. Please try again.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const supportPhone = appSettings?.supportPhone || appSettings?.contactPhone || '9601715367';
  const supportEmail = appSettings?.supportEmail || appSettings?.contactEmail || 'olovelytotalsuvidha@gmail.com';
  const companyAddress = appSettings?.companyAddress || [appSettings?.companyCity, appSettings?.companyState, appSettings?.companyCountry].filter(Boolean).join(', ') || 'India';

  return (
    <div className="pb-24 md:pb-12 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white pb-6 pt-4 sticky top-0 z-10 border-b border-neutral-100">
        <div className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="text-neutral-900 hover:text-teal-600 transition-colors p-1 -ml-1 rounded-lg"
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Help & Support</h1>
              <p className="text-xs text-neutral-500">We're here to help you 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
        {/* Support Desk Banner */}
        <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-2xl p-5 md:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-800/60 px-2.5 py-0.5 rounded-full">
              {isSellerSupport ? 'Seller Support Desk' : 'Customer Support Desk'}
            </span>
            <h2 className="text-base md:text-lg font-bold mt-1 text-white">
              {isSellerSupport ? 'Need Help With Your Seller Account?' : 'Have an Order Issue or Active Ticket?'}
            </h2>
            <p className="text-xs text-teal-100/90 mt-0.5 max-w-lg">
              {isSellerSupport
                ? 'Get help with seller onboarding, catalog management, orders, settlements, or your seller account.'
                : 'View your existing inquiries, reply directly to support executives, or raise an order-linked support ticket.'}
            </p>
          </div>
          {!isSellerSupport && (
            <Link
              to="/support/tickets"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-teal-950 bg-teal-300 hover:bg-white rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              My Support Tickets
            </Link>
          )}
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Phone */}
          <a
            href={`tel:${supportPhone}`}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:border-teal-400 hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Call Us</h2>
              <p className="text-sm font-bold text-neutral-900 mt-0.5 truncate">+91 {supportPhone}</p>
              <p className="text-xs text-teal-600 font-medium mt-1">Tap to call</p>
            </div>
          </a>

          {/* Email */}
          <a
            href={`mailto:${supportEmail}`}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:border-teal-400 hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Email Us</h2>
              <p className="text-sm font-bold text-neutral-900 mt-0.5 truncate">{supportEmail}</p>
              <p className="text-xs text-emerald-600 font-medium mt-1">Tap to send email</p>
            </div>
          </a>

          {/* Office / Hours */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Support Hours</h2>
              <p className="text-sm font-bold text-neutral-900 mt-0.5">24 Hours / 7 Days</p>
              <p className="text-xs text-neutral-500 mt-1 truncate">{companyAddress}</p>
            </div>
          </div>
        </div>

        {/* Contact Form Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 text-white">
            <h2 className="text-lg font-bold">Send Us a Message</h2>
            <p className="text-xs text-teal-100 mt-0.5">
              Have questions, feedback, or need help with your orders or account? Submit the form below.
            </p>
          </div>

          <div className="p-6">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">Message Sent Successfully!</h3>
                <p className="text-sm text-neutral-600 max-w-md mx-auto mb-6">
                  Thank you for reaching out. Our support team has received your inquiry and will respond to your email as soon as possible.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full px-3.5 py-2.5 text-sm bg-neutral-50 rounded-xl border ${
                        errors.name ? 'border-red-400 focus:border-red-500' : 'border-neutral-200 focus:border-teal-500'
                      } outline-hidden transition-all`}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rahul@example.com"
                      className={`w-full px-3.5 py-2.5 text-sm bg-neutral-50 rounded-xl border ${
                        errors.email ? 'border-red-400 focus:border-red-500' : 'border-neutral-200 focus:border-teal-500'
                      } outline-hidden transition-all`}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Order Inquiry, Delivery Question, Account Issue"
                    className={`w-full px-3.5 py-2.5 text-sm bg-neutral-50 rounded-xl border ${
                      errors.subject ? 'border-red-400 focus:border-red-500' : 'border-neutral-200 focus:border-teal-500'
                    } outline-hidden transition-all`}
                  />
                  {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe your question or issue in detail..."
                    className={`w-full px-3.5 py-2.5 text-sm bg-neutral-50 rounded-xl border ${
                      errors.message ? 'border-red-400 focus:border-red-500' : 'border-neutral-200 focus:border-teal-500'
                    } outline-hidden transition-all resize-y`}
                  />
                  {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                  <p className="text-[11px] text-neutral-400 mt-1 text-right">{message.length}/2000 characters</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span>Submit Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Helpful Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to={faqPath}
            className="bg-white p-4 rounded-xl border border-neutral-200 hover:border-teal-400 hover:shadow-xs transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Frequently Asked Questions</h3>
                <p className="text-xs text-neutral-500">Quick answers to common questions</p>
              </div>
            </div>
            <span className="text-neutral-400 group-hover:text-teal-600 transition-colors">›</span>
          </Link>

          <Link
            to={policyPath}
            className="bg-white p-4 rounded-xl border border-neutral-200 hover:border-teal-400 hover:shadow-xs transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Privacy & Terms Policy</h3>
                <p className="text-xs text-neutral-500">
                  {isSellerSupport ? 'Read our seller terms and policies' : 'Read our customer terms and policies'}
                </p>
              </div>
            </div>
            <span className="text-neutral-400 group-hover:text-emerald-600 transition-colors">›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
