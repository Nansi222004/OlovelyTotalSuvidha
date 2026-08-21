import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getDeliveryProfile } from '../../../services/api/delivery/deliveryService';

export default function DeliveryAbout() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getDeliveryProfile();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">Profile & About</h2>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200 mb-4">
          {loading ? (
            <div className="text-center text-neutral-500 text-sm">Loading profile...</div>
          ) : profile ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-3 text-teal-600 font-bold text-2xl">
                {profile.name?.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-neutral-900 text-lg font-bold">{profile.name}</h3>
              <p className="text-neutral-500 text-sm mb-1">+91 {profile.mobile}</p>
              <p className="text-neutral-400 text-xs mb-3">{profile.email}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${profile.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                {profile.status}
              </span>

              <div className="w-full mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-neutral-500 text-xs">City</p>
                  <p className="text-neutral-800 text-sm font-medium">{profile.city}</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-xs">Joining Date</p>
                  <p className="text-neutral-800 text-sm font-medium">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-red-500 text-sm">Failed to load profile</div>
          )}
        </div>

        {/* App Info Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200 mb-4">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-4">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 17H4L5 12H19L20 17H22M2 17C2 18.1046 2.89543 19 4 19C5.10457 19 6 18.1046 6 17M2 17C2 15.8954 2.89543 15 4 15C5.10457 15 6 15.8954 6 17M22 17C22 18.1046 21.1046 19 20 19C18.8954 19 18 18.1046 18 17M22 17C22 15.8954 21.1046 15 20 15C18.8954 15 18 15.8954 18 17M6 17H18M5 12L4 7H2M20 12L21 7H22"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <h3 className="text-neutral-900 text-xl font-semibold mb-1">Delivery App</h3>
            <p className="text-neutral-500 text-sm">Version 1.0.0</p>
          </div>
        </div>

        {/* About Content */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden mb-4">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">About the App</h3>
          </div>
          <div className="p-4">
            <p className="text-neutral-600 text-sm leading-relaxed mb-4">
              Delivery App is a comprehensive platform designed to help delivery partners manage their orders efficiently,
              track earnings, and provide excellent service to customers.
            </p>
            <p className="text-neutral-600 text-sm leading-relaxed">
              Our mission is to empower delivery partners with the tools they need to succeed in the fast-growing
              delivery industry.
            </p>
          </div>
        </div>

        {/* App Details */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden mb-4">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">App Information</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            <div className="p-4 flex justify-between items-center">
              <p className="text-neutral-500 text-sm">Version</p>
              <p className="text-neutral-900 text-sm font-medium">1.0.0</p>
            </div>
            <div className="p-4 flex justify-between items-center">
              <p className="text-neutral-500 text-sm">Platform</p>
              <p className="text-neutral-900 text-sm font-medium">Web / PWA</p>
            </div>
          </div>
        </div>

        {/* Legal Policies */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">Legal & Policies</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            <button
              onClick={() => navigate('/delivery/privacy-policy')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left">
              <span className="text-neutral-900 text-sm font-medium">Privacy Policy</span>
              <span className="text-orange-600 text-xs font-semibold">View &rarr;</span>
            </button>
            <button
              onClick={() => navigate('/delivery/terms-and-conditions')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left">
              <span className="text-neutral-900 text-sm font-medium">Terms & Conditions</span>
              <span className="text-orange-600 text-xs font-semibold">View &rarr;</span>
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center">
          <p className="text-neutral-400 text-xs">© 2026 Olovely Total Suvidha. All rights reserved.</p>
        </div>
      </div>
      <DeliveryBottomNav />
    </div>
  );
}


