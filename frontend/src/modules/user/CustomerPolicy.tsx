import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api/config';

interface PolicyData {
  _id?: string;
  title: string;
  content: string;
  version?: string;
  updatedAt?: string;
}

export default function CustomerPolicy() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCustomerPolicy = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/customer/policy');
        if (response.data && response.data.success && response.data.data) {
          setPolicy(response.data.data);
        } else {
          setError(response.data?.message || 'Policy not found');
        }
      } catch (err: any) {
        console.error('Failed to fetch customer policy:', err);
        setError(err.response?.data?.message || 'Failed to load policy');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomerPolicy();
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
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white pb-6 pt-4 sticky top-0 z-10 border-b border-neutral-100">
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-neutral-900 hover:text-teal-600 transition-colors"
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-neutral-900">
              {policy?.title || 'Privacy & Terms Policy'}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-sm text-neutral-600">Loading policy...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center bg-red-50 rounded-2xl p-6 border border-red-100">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 text-red-500">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-red-700 mb-1">{error}</p>
            <p className="text-xs text-neutral-500 mb-4">Please try again later or contact support if the issue persists.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-white">
            {policy?.updatedAt && (
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-6 pb-4 border-b border-neutral-100">
                <span>Last Updated: {formatDate(policy.updatedAt)}</span>
                {policy.version && <span>Version: {policy.version}</span>}
              </div>
            )}

            {/* Formatted Policy Content */}
            <div className="prose prose-sm max-w-none text-neutral-700 leading-relaxed whitespace-pre-wrap font-sans">
              {policy?.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
