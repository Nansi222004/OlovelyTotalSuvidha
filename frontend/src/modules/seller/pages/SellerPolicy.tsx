import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api/config';

interface PolicyData {
  _id?: string;
  title: string;
  content: string;
  version?: string;
  updatedAt?: string;
}

export default function SellerPolicy() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSellerPolicy = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/seller/policy');
        if (response.data && response.data.success && response.data.data) {
          setPolicy(response.data.data);
        } else {
          setPolicy(null);
        }
      } catch (err: any) {
        console.error('Failed to fetch seller policy:', err);
        setError(err.response?.data?.message || 'Failed to load policy');
      } finally {
        setLoading(false);
      }
    };
    fetchSellerPolicy();
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="pb-24 md:pb-8 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="bg-white pb-5 pt-4 sticky top-0 z-10 border-b border-neutral-200 shadow-sm">
        <div className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              aria-label="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wide">
                Seller
              </span>
              <h1 className="text-lg md:text-xl font-bold text-neutral-900">
                {policy?.title || 'Seller Terms & Policy'}
              </h1>
            </div>
          </div>
          <button
            onClick={() => navigate('/seller/support')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors"
          >
            Seller Support
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 md:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-sm text-neutral-600">Loading seller policy...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center bg-red-50 rounded-2xl p-6 border border-red-100 max-w-lg mx-auto">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 text-red-500">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-red-700 mb-1">{error}</p>
            <p className="text-xs text-neutral-500 mb-4">Please check your connection and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : policy ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-neutral-200">
            {policy.updatedAt && (
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-6 pb-4 border-b border-neutral-100">
                <span>Last Updated: {formatDate(policy.updatedAt)}</span>
                {policy.version && (
                  <span className="bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full font-medium border border-teal-200">
                    Version {policy.version}
                  </span>
                )}
              </div>
            )}

            {/* Formatted Policy Content */}
            <div className="prose prose-sm max-w-none text-neutral-800 leading-relaxed whitespace-pre-wrap font-sans">
              {policy.content}
            </div>
          </div>
        ) : (
          /* Clean Unavailable State */
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-neutral-200 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Policy Currently Unavailable</h2>
            <p className="text-sm text-neutral-600 leading-relaxed mb-6">
              The Seller & Vendor terms are currently being updated. Please check back shortly or reach out to our merchant care team if you have questions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/seller/support')}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors"
              >
                Contact Seller Support
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto px-5 py-2.5 border border-neutral-300 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
