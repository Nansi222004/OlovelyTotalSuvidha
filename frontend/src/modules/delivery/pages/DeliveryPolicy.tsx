import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import api from '../../../services/api/config';

export default function DeliveryPolicy() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const isPrivacy = location.pathname.includes('privacy');
  const docType = isPrivacy ? 'privacy' : 'terms';
  const title = isPrivacy
    ? t('common.privacyPolicy', 'Privacy Policy')
    : t('common.termsConditions', 'Terms & Conditions');

  const [policyData, setPolicyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/delivery/policy?type=${docType}`);
        setPolicyData(res.data?.success && res.data?.data ? res.data.data : null);
      } catch (err: any) {
        console.error(`Failed to fetch ${docType} policy:`, err);
        setError(err.response?.data?.message || `${t('common.error', 'Failed to load')} ${title}`);
      } finally {
        setLoading(false);
      }
    };

    void fetchPolicy();
  }, [docType, t, title]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/delivery/login');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800">
                Delivery
              </span>
              <h1 className="text-lg font-bold text-neutral-900 md:text-xl">{title}</h1>
            </div>
          </div>
          <Link
            to="/delivery/support"
            className="text-xs font-semibold text-orange-700 transition-colors hover:text-orange-900"
          >
            Support
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        <div className="min-h-[300px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
              <p className="text-sm text-neutral-500">{t('common.loading', 'Loading document...')}</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : policyData ? (
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-neutral-200 pb-4">
                <h2 className="text-lg font-bold text-neutral-900">{policyData.title || title}</h2>
                {policyData.version && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                    v{policyData.version}
                  </span>
                )}
              </div>
              <div
                className="prose max-w-none whitespace-pre-line text-sm leading-relaxed text-neutral-700"
                dangerouslySetInnerHTML={{ __html: policyData.content }}
              />
              {policyData.updatedAt && (
                <p className="mt-6 border-t border-neutral-100 pt-4 text-xs text-neutral-400">
                  Last updated:{' '}
                  {new Date(policyData.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-md py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2 className="mb-2 text-base font-bold text-neutral-900">Policy Currently Unavailable</h2>
              <p className="mb-5 text-xs leading-relaxed text-neutral-500">
                The delivery partner {isPrivacy ? 'privacy policy' : 'terms and conditions'} are currently being updated. Please check back shortly or reach out to partner support.
              </p>
              <Link
                to="/delivery/support"
                className="inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Delivery Partner Support
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
