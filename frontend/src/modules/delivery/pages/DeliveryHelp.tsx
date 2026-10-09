import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { getHelpSupport } from '../../../services/api/delivery/deliveryService';

const getIcon = (iconName: string) => {
  if (iconName === 'phone') return '📞';
  if (iconName === 'email') return '✉️';
  if (iconName === 'chat') return '💬';
  return 'ℹ️';
};

export default function DeliveryHelp() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHelp = async () => {
      try {
        const data = await getHelpSupport();
        setFaqs(data.faqs || []);
        setContacts(data.contact || []);
      } catch (error) {
        console.error('Failed to load help data', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchHelp();
  }, []);

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
            <div>
              <div className="mb-0.5 flex items-center gap-2">
                <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800">
                  Delivery
                </span>
                <h1 className="text-lg font-bold text-neutral-900 md:text-xl">
                  {t('delivery.helpSupport', 'Help & Support')}
                </h1>
              </div>
              <p className="text-xs text-neutral-500">Delivery partner assistance</p>
            </div>
          </div>
          <Link
            to="/delivery/privacy-policy"
            className="text-xs font-semibold text-orange-700 transition-colors hover:text-orange-900"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 md:px-6 lg:px-8">
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-b-orange-500" />
            <p className="text-sm text-neutral-500">{t('common.loading', 'Loading help content...')}</p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 p-5 text-white shadow-md md:p-6">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                Delivery Partner Support
              </span>
              <h2 className="mt-2 text-lg font-bold">How can we help?</h2>
              <p className="mt-1 max-w-xl text-xs text-orange-50">
                Find answers or contact the Delivery support team without signing in.
              </p>
            </section>

            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 p-4">
                <h2 className="font-semibold text-neutral-900">{t('delivery.contactUs', 'Contact Us')}</h2>
              </div>
              <div className="divide-y divide-neutral-200">
                {contacts.map((option, index) => {
                  const isPhone = option.icon === 'phone' || option.label.toLowerCase().includes('call');
                  const isEmail = option.icon === 'email' || option.label.toLowerCase().includes('email');
                  const href = isPhone
                    ? `tel:${option.value.replace(/\s+/g, '')}`
                    : isEmail
                      ? `mailto:${option.value}`
                      : undefined;

                  const content = (
                    <>
                      <div>
                        <p className="mb-1 text-sm font-medium text-neutral-900">{option.label}</p>
                        <p className={href ? 'text-xs font-semibold text-orange-600' : 'text-xs text-neutral-500'}>
                          {option.value}
                        </p>
                      </div>
                      <div className="text-2xl">{getIcon(option.icon)}</div>
                    </>
                  );

                  return href ? (
                    <a
                      key={index}
                      href={href}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-neutral-50"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={index} className="flex items-center justify-between p-4">
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 p-4">
                <h2 className="font-semibold text-neutral-900">
                  {t('delivery.frequentlyAskedQuestions', 'Frequently Asked Questions')}
                </h2>
              </div>
              <div className="divide-y divide-neutral-200">
                {faqs.map((item, index) => (
                  <div key={index} className="p-4">
                    <p className="mb-2 text-sm font-medium text-neutral-900">{item.question}</p>
                    <p className="text-xs leading-relaxed text-neutral-500">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
