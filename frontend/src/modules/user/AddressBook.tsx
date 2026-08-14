import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Address,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../../services/api/customerAddressService";

const iconStyle = "w-5 h-5 text-amber-600 flex-shrink-0";

function buildAddressLine(address: Address) {
  const parts = [
    address.address,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function AddressBook() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getAddresses();
      if (res.success && Array.isArray(res.data)) {
        setAddresses(res.data as Address[]);
      } else {
        setError(res.message || "Failed to load addresses");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load addresses"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleShare = async (address: Address) => {
    const text = `${address.fullName || "Address"}\n${buildAddressLine(
      address
    )}\nPhone: ${address.phone}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Saved address", text });
      } catch {
        // user cancelled; no-op
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert("Address copied to clipboard");
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Remove this address?")) return;
    try {
      setBusyId(id);
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a._id !== id));
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to delete address"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMakeDefault = async (id?: string) => {
    if (!id) return;
    try {
      setBusyId(id);
      await updateAddress(id, { isDefault: true });
      // Optimistically mark default locally
      setAddresses((prev) =>
        prev.map((addr) => ({ ...addr, isDefault: addr._id === id }))
      );
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to mark as default"
      );
    } finally {
      setBusyId(null);
    }
  };

  const defaultBadge = useMemo(
    () => (
      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full">
        Default
      </span>
    ),
    []
  );

  return (
    <div className="min-h-screen bg-white md:bg-neutral-50 pb-24 md:pb-10">
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="p-2 rounded-full hover:bg-neutral-100 text-neutral-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <div>
          <p className="text-xs text-neutral-500">Your saved addresses</p>
          <h1 className="text-base font-semibold text-neutral-900">
            Address book
          </h1>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => navigate("/checkout/address")}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded-full hover:bg-teal-700"
          >
            Add new
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 pb-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg p-4 text-sm">
            {error}
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white border border-dashed border-neutral-200 rounded-lg p-6 text-center">
            <p className="text-neutral-700 font-semibold mb-1">
              No addresses yet
            </p>
            <p className="text-sm text-neutral-500 mb-3">
              Save an address to checkout faster next time.
            </p>
            <button
              onClick={() => navigate("/checkout/address")}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-full hover:bg-teal-700"
            >
              Add address
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const isBusy = busyId === addr._id;
              return (
                <div
                  key={addr._id || addr.phone}
                  className="bg-white border border-neutral-200 rounded-xl shadow-[0_1px_6px_rgba(0,0,0,0.05)] p-3 transition hover:shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <svg
                        viewBox="0 0 24 24"
                        className={iconStyle}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M3 9.5 12 3l9 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
                        <path d="M9 21V12h6v9" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="text-sm font-semibold text-neutral-900">
                          {addr.type || "Home"}
                        </span>
                        {addr.isDefault && defaultBadge}
                      </div>
                      <p className="text-xs text-green-700 font-semibold mt-0.5">
                        Saved address
                      </p>
                      <p className="text-sm text-neutral-800 leading-relaxed mt-2">
                        {buildAddressLine(addr)}
                      </p>
                      <p className="text-sm text-neutral-700 mt-1">
                        Phone number: {addr.phone || "Not added"}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-teal-700">
                        <button
                          onClick={() => handleShare(addr)}
                          className="flex items-center gap-1 text-sm font-semibold hover:text-teal-800"
                          disabled={isBusy}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <path d="m8.59 13.51 6.83 3.98" />
                            <path d="m15.41 6.51-6.82 3.98" />
                          </svg>
                          Share
                        </button>
                        <button
                          onClick={() => handleMakeDefault(addr._id)}
                          className="flex items-center gap-1 text-sm font-semibold hover:text-teal-800 disabled:text-neutral-400"
                          disabled={isBusy || addr.isDefault}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m9 11 3 3L22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          {addr.isDefault ? "Default" : "Set default"}
                        </button>
                        <button
                          onClick={() => handleDelete(addr._id)}
                          className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700 disabled:text-neutral-400"
                          disabled={isBusy}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
                            <path d="M10 11h4" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

