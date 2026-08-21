import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DeliveryHeader from "../components/DeliveryHeader";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import api from "../../../services/api/config";

export default function DeliveryPolicy() {
  const navigate = useNavigate();
  const location = useLocation();

  const isPrivacy = location.pathname.includes("privacy");
  const docType = isPrivacy ? "privacy" : "terms";
  const title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";

  const [policyData, setPolicyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/delivery/policy?type=${docType}`);
        if (res.data?.success && res.data?.data) {
          setPolicyData(res.data.data);
        } else {
          setPolicyData(null);
        }
      } catch (err: any) {
        console.error(`Failed to fetch ${docType} policy:`, err);
        setError(err.response?.data?.message || `Failed to load ${title}`);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, [docType, title]);

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">{title}</h2>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3"></div>
              <p className="text-neutral-500 text-sm">Loading document...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : policyData ? (
            <div>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-neutral-200">
                <h3 className="text-neutral-900 font-bold text-lg">
                  {policyData.title || title}
                </h3>
                {policyData.version && (
                  <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                    v{policyData.version}
                  </span>
                )}
              </div>
              <div
                className="text-neutral-700 text-sm leading-relaxed whitespace-pre-line prose max-w-none"
                dangerouslySetInnerHTML={{ __html: policyData.content }}
              />
              {policyData.updatedAt && (
                <p className="text-neutral-400 text-xs mt-6 pt-4 border-t border-neutral-100">
                  Last updated:{" "}
                  {new Date(policyData.updatedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-neutral-900 font-bold mb-2">{title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">
                {isPrivacy
                  ? "Olovely Total Suvidha respects your privacy and ensures all delivery partner location and personal data are protected in accordance with industry security standards."
                  : "By using the Olovely Total Suvidha Delivery Partner app, you agree to fulfill assigned deliveries promptly, maintain customer privacy, and comply with safety and service guidelines."}
              </p>
            </div>
          )}
        </div>
      </div>
      <DeliveryBottomNav />
    </div>
  );
}
