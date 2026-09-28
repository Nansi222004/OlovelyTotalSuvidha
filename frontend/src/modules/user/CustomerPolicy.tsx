import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api/config';

interface PolicyData {
  _id?: string;
  title: string;
  content: string;
  version?: string;
  updatedAt?: string;
}

type PolicyBlock =
  | { type: 'heading'; number?: string; title: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'paragraph'; text: string }
  | { type: 'contact'; text: string }
  | { type: 'lastUpdated'; text: string };

function parsePolicyContent(content: string): PolicyBlock[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const blocks: PolicyBlock[] = [];
  let currentBullets: { type: 'bullets'; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', text: currentParagraph.join(' ') });
      currentParagraph = [];
    }
  };

  const flushBullets = () => {
    if (currentBullets && currentBullets.items.length > 0) {
      blocks.push(currentBullets);
      currentBullets = null;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }

    // Numbered heading match: e.g. "1. Account Registration", "1) Account Registration", "Section 1: ..."
    const sectionMatch = trimmed.match(/^(?:section|article|clause)?\s*(\d+(?:\.\d+)*)[\.\):\-\s]\s*(.+)$/i);
    // Bullet match: e.g. "- item", "* item", "• item", "– item"
    const bulletMatch = rawLine.match(/^\s*[-•*–—]\s+(.+)$/);
    const isContact =
      /contact (our )?customer support/i.test(trimmed) ||
      /questions or concerns/i.test(trimmed);
    const isLastUpdated = /^last updated:/i.test(trimmed);

    if (sectionMatch && !bulletMatch) {
      flushParagraph();
      flushBullets();
      blocks.push({
        type: 'heading',
        number: sectionMatch[1],
        title: sectionMatch[2].replace(/^[:\-\s]+/, '').trim(),
      });
    } else if (bulletMatch) {
      flushParagraph();
      if (!currentBullets) {
        currentBullets = { type: 'bullets', items: [] };
      }
      currentBullets.items.push(bulletMatch[1].trim());
    } else if (isContact) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'contact', text: trimmed });
    } else if (isLastUpdated) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'lastUpdated', text: trimmed });
    } else {
      flushBullets();
      currentParagraph.push(trimmed);
    }
  }

  flushParagraph();
  flushBullets();
  return blocks;
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
          setPolicy(null);
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

  const parsedBlocks = useMemo(() => {
    return policy?.content ? parsePolicyContent(policy.content) : [];
  }, [policy?.content]);

  return (
    <div className="pb-24 md:pb-12 bg-neutral-50/60 min-h-screen">
      {/* Sticky Header */}
      <header className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-neutral-200/80 shadow-xs">
        <div className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-700 hover:text-teal-600 hover:bg-neutral-100 active:scale-95 transition-all"
                aria-label="Back"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight line-clamp-1">
                {policy?.title || 'Customer App Policy'}
              </h1>
            </div>

            <button
              onClick={() => navigate('/support')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors hidden sm:block"
            >
              Need Help?
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="px-3 sm:px-4 md:px-6 lg:px-8 py-5 sm:py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600 mx-auto mb-3"></div>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium">Loading policy details...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center bg-red-50/80 rounded-2xl p-6 border border-red-100 max-w-lg mx-auto">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 text-red-500">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-red-700 mb-1">{error}</p>
            <p className="text-xs text-neutral-500 mb-4">Please check your connection and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : policy ? (
          <article className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 overflow-hidden">
            {/* Document Header with Meta */}
            <div className="p-4 sm:p-6 md:p-8 border-b border-neutral-100 bg-gradient-to-b from-teal-50/40 to-transparent">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                  Official Policy
                </span>

                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                  {policy.version && (
                    <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md font-mono text-[11px]">
                      v{policy.version}
                    </span>
                  )}
                  {policy.updatedAt && (
                    <span>Last updated: {formatDate(policy.updatedAt)}</span>
                  )}
                </div>
              </div>

              <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-neutral-900 mt-3 tracking-tight">
                {policy.title || 'Customer App Policy'}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Please read these terms carefully before placing orders on Olovely Total Suvidha.
              </p>
            </div>

            {/* Document Body */}
            <div className="p-4 sm:p-6 md:p-8 space-y-4">
              {parsedBlocks.map((block, idx) => {
                if (block.type === 'heading') {
                  return (
                    <div
                      key={idx}
                      className="pt-5 mt-5 border-t border-neutral-100/90 first:pt-0 first:mt-0 first:border-0"
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        {block.number && (
                          <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center border border-teal-100/80 flex-shrink-0">
                            {block.number}
                          </span>
                        )}
                        <h3 className="text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                          {block.title}
                        </h3>
                      </div>
                    </div>
                  );
                }

                if (block.type === 'bullets') {
                  return (
                    <ul key={idx} className="space-y-2.5 pl-0.5 sm:pl-1">
                      {block.items.map((item, itemIdx) => (
                        <li
                          key={itemIdx}
                          className="flex items-start gap-2.5 text-[13px] sm:text-sm text-neutral-600 leading-[1.65]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-2 flex-shrink-0" />
                          <span className="flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === 'contact') {
                  return (
                    <div key={idx} className="mt-8 pt-6 border-t border-neutral-100">
                      <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-neutral-900">{block.text}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Our customer support team is available to assist you with any questions.
                          </p>
                        </div>
                        <button
                          onClick={() => navigate('/support')}
                          className="inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex-shrink-0"
                        >
                          Contact Support
                        </button>
                      </div>
                    </div>
                  );
                }

                if (block.type === 'lastUpdated') {
                  return (
                    <p key={idx} className="text-xs text-neutral-400 mt-4 text-center sm:text-left font-medium">
                      {block.text}
                    </p>
                  );
                }

                // Default: regular paragraph
                return (
                  <p
                    key={idx}
                    className="text-[13px] sm:text-sm text-neutral-700 leading-relaxed font-normal"
                  >
                    {block.text}
                  </p>
                );
              })}
            </div>
          </article>
        ) : (
          /* Clean Policy Currently Unavailable state */
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-neutral-200 text-center max-w-lg mx-auto mt-6">
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
              Our customer privacy and service policy is currently being updated. Please check back shortly or reach out to our customer care team if you have any questions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/support')}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors"
              >
                Help & Support
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-5 py-2.5 border border-neutral-300 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
