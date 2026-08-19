import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext';
import SupportModal from '../../components/SupportModal';

export default function AboutUs() {
    const navigate = useNavigate();
    const { settings: appSettings } = useAppSettings();
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

    return (
        <div className="pb-24 md:pb-8 bg-white min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-b from-teal-50 to-white pb-6 pt-4 sticky top-0 z-10 border-b border-neutral-100">
                <div className="px-4 md:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-neutral-900"
                            aria-label="Back"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-neutral-900">About Us</h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 md:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
                {/* Logo/Brand Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-2 mb-4 shadow-md border border-neutral-200">
                        <img
                            src={appSettings?.appLogo || '/assets/olovelylogo.png'}
                            alt={appSettings?.appName || 'Olovely'}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/olovelylogo.png';
                            }}
                        />
                    </div>
                    <h2 className="text-3xl font-bold text-neutral-900 mb-2">{appSettings?.appName || 'Olovely Total Suvidha'}</h2>
                    <p className="text-sm text-neutral-600">Your Trusted Delivery Partner</p>
                </div>

                {/* Mission Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Our Mission
                    </h3>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                        At Olovely, we're committed to revolutionizing the way you shop and receive your products.
                        Our mission is to provide lightning-fast delivery services while maintaining the highest
                        standards of quality and customer satisfaction.
                    </p>
                </div>

                {/* What We Do Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        What We Do
                    </h3>
                    <p className="text-sm text-neutral-700 leading-relaxed mb-4">
                        Olovely Total Suvidha is a comprehensive e-commerce platform that connects customers with a wide range
                        of products across multiple categories including groceries, fashion, electronics, pharmacy,
                        and much more.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                            <div className="text-2xl font-bold text-teal-600 mb-1">10K+</div>
                            <div className="text-xs text-neutral-700">Products</div>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                            <div className="text-2xl font-bold text-teal-600 mb-1">500+</div>
                            <div className="text-xs text-neutral-700">Sellers</div>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                            <div className="text-2xl font-bold text-teal-600 mb-1">50K+</div>
                            <div className="text-xs text-neutral-700">Happy Customers</div>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                            <div className="text-2xl font-bold text-teal-600 mb-1">24/7</div>
                            <div className="text-xs text-neutral-700">Support</div>
                        </div>
                    </div>
                </div>

                {/* Why Choose Us Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Why Choose Us
                    </h3>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-900 mb-1">Fast Delivery</h4>
                                <p className="text-xs text-neutral-600">Get your orders delivered at lightning speed with our efficient delivery network.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-900 mb-1">Secure Payments</h4>
                                <p className="text-xs text-neutral-600">Your transactions are protected with industry-standard encryption and security.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-900 mb-1">Quality Products</h4>
                                <p className="text-xs text-neutral-600">We partner with trusted sellers to ensure you receive only the best quality products.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-900 mb-1">24/7 Support</h4>
                                <p className="text-xs text-neutral-600">Our dedicated support team is always ready to help you with any queries.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl p-6 border border-teal-200">
                    <h3 className="text-lg font-bold text-neutral-900 mb-4 text-center">Get In Touch</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600 flex-shrink-0">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <button
                                type="button"
                                onClick={() => setIsSupportModalOpen(true)}
                                className="text-neutral-700 hover:text-teal-700 hover:underline transition-colors text-left"
                            >
                                {appSettings?.supportEmail || appSettings?.contactEmail || 'olovelytotalsuvidha@gmail.com'}
                            </button>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600 flex-shrink-0">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <a
                                href={`tel:${appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}`}
                                className="text-neutral-700 hover:text-teal-700 hover:underline transition-colors"
                            >
                                +91 {appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}
                            </a>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-600 flex-shrink-0">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-neutral-700">
                                {appSettings?.companyAddress || [appSettings?.companyCity, appSettings?.companyState, appSettings?.companyCountry].filter(Boolean).join(', ') || 'India'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Version Info */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-neutral-500">Version 1.0.0</p>
                    <p className="text-xs text-neutral-500 mt-1">© {new Date().getFullYear()} {appSettings?.appName || 'Olovely Total Suvidha'}. All rights reserved.</p>
                </div>
            </div>

            <SupportModal
                isOpen={isSupportModalOpen}
                onClose={() => setIsSupportModalOpen(false)}
            />
        </div>
    );
}

