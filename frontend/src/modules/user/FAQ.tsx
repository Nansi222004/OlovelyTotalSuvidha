import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext';
import SupportModal from '../../components/SupportModal';
import api from '../../services/api/config';
import { useTranslation } from '../../hooks/useTranslation';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  translations?: Record<string, Record<string, string>>;
}

const defaultFaqData: FAQItem[] = [
  {
    id: '1',
    question: 'How do I place an order?',
    answer: 'To place an order, simply browse our products, add items to your cart, and proceed to checkout. You\'ll need to provide your delivery address and payment details. Once confirmed, your order will be processed and delivered to you.',
  },
  {
    id: '2',
    question: 'What are the delivery charges?',
    answer: 'Delivery charges vary based on your location and order value. We offer free delivery on orders above ₹199. For orders below this threshold, a nominal delivery fee applies. You can check the exact charges during checkout.',
  },
  {
    id: '3',
    question: 'How long does delivery take?',
    answer: 'We typically deliver within 17-20 minutes for most locations. Delivery time may vary based on your location, order size, and current demand. You\'ll receive real-time updates about your order status.',
  },
  {
    id: '4',
    question: 'Can I cancel my order?',
    answer: 'Yes, you can cancel your order before it\'s confirmed by the seller. Once confirmed, cancellation may not be possible. Please check our cancellation policy for more details. Refunds are processed within 5-7 business days.',
  },
  {
    id: '5',
    question: 'What payment methods do you accept?',
    answer: 'We accept various payment methods including credit/debit cards, UPI, net banking, and digital wallets. Cash on delivery (COD) is also available for select locations.',
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const { t, getTranslatedField } = useTranslation();
  const { settings: appSettings } = useAppSettings();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [faqs, setFaqs] = useState<FAQItem[]>(defaultFaqData);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await api.get('/customer/faqs');
        if (response.data && response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
          const mappedFaqs = response.data.data.map((f: any) => ({
            id: f._id,
            question: f.question,
            answer: f.answer,
            translations: f.translations,
          }));
          setFaqs(mappedFaqs);
        }
      } catch (err) {
        console.error("Failed to fetch customer FAQs:", err);
      }
    };
    fetchFaqs();
  }, []);

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-200 via-green-100 to-white pb-6 md:pb-8 pt-12 md:pt-16">
        <div className="px-4 md:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-neutral-900"
            aria-label="Back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center mb-4 md:mb-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                className="text-green-600 md:w-12 md:h-12"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">
              Frequently Asked Questions
            </h1>
            <p className="text-sm md:text-base text-neutral-600 text-center px-4">
              Find answers to common questions about our services
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-3">
            {faqs.map((item) => {
              const isOpen = openItems.has(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-neutral-200 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <span className="text-sm md:text-base font-semibold text-neutral-900 pr-4">
                      {getTranslatedField(item, 'question')}
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`flex-shrink-0 text-neutral-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-sm md:text-base text-neutral-600 leading-relaxed">
                        {getTranslatedField(item, 'answer')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Support Section */}
          <div className="mt-8 bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                className="mx-auto mb-4 text-green-600"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 8H7M17 12H7M17 16H7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                Still have questions?
              </h3>
              <p className="text-sm text-neutral-600 mb-4">
                Our customer support team is here to help you 24/7
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:scale-[0.98] transition-all text-sm cursor-pointer shadow-xs"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="22,6 12,13 2,6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Contact Support
                </button>
                <a
                  href={`tel:${appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-600 border-2 border-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors text-sm"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Call +91 {appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Contact Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
}


