import { useState, useEffect } from "react";
import {
  getPaymentMethodConfigs as getPaymentMethods,
  updatePaymentMethod,
  updatePaymentMethodStatus,
  type PaymentMethodConfig as PaymentMethod,
} from "../../../services/api/admin/adminPaymentService";
import { useAuth } from "../../../context/AuthContext";

export default function AdminPaymentList() {
  const { isAuthenticated, token } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default payment methods - COD and Razorpay only
  const defaultPaymentMethods: PaymentMethod[] = [
    {
      _id: 'cod',
      name: 'Cash On Delivery (COD)',
      description: 'Pay when you receive your order',
      status: 'Active',
      hasApiKeys: false,
      type: 'cod',
    },
    {
      _id: 'razorpay',
      name: 'Razorpay',
      description: 'Pay securely with Razorpay',
      status: 'Active',
      hasApiKeys: true,
      apiKey: '',
      secretKey: '',
      provider: 'razorpay',
      type: 'gateway',
    },
  ];

  // Fetch payment methods on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Use default payment methods when not authenticated
      setPaymentMethods(defaultPaymentMethods);
      setLoading(false);
      return;
    }

    const fetchPaymentMethods = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPaymentMethods();

        if (response.success && response.data.length > 0) {
          setPaymentMethods(response.data);
        } else {
          // Use default payment methods if API returns empty
          setPaymentMethods(defaultPaymentMethods);
        }
      } catch (err: any) {
        console.error("Error fetching payment methods:", err);
        // Use default payment methods on error
        setPaymentMethods(defaultPaymentMethods);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentMethods();
  }, [isAuthenticated, token]);

  const handleUpdate = (id: string, field: string, value: string) => {
    setPaymentMethods((prev) =>
      prev.map((method) =>
        method._id === id ? { ...method, [field]: value } : method
      )
    );
  };

  const handleStatusChange = async (
    id: string,
    newStatus: "Active" | "InActive"
  ) => {
    try {
      const response = await updatePaymentMethodStatus(id, newStatus);

      if (response.success) {
        setPaymentMethods((prev) =>
          prev.map((method) =>
            method._id === id ? { ...method, status: newStatus } : method
          )
        );
        alert(`Payment method status updated successfully!`);
      } else {
        alert(
          "Failed to update status: " + (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error updating payment method status:", err);
      alert(
        "Failed to update status: " +
        (err.response?.data?.message || "Please try again.")
      );
    }
  };

  const handleUpdatePaymentMethod = async (id: string) => {
    const method = paymentMethods.find((m) => m._id === id);
    if (!method) return;

    try {
      setUpdating(id);

      const updateData: any = {
        description: method.description,
        status: method.status,
      };

      if (method.hasApiKeys) {
        updateData.apiKey = method.apiKey || "";
        updateData.secretKey = method.secretKey || "";
      }

      const response = await updatePaymentMethod(id, updateData);

      if (response.success) {
        alert(`${method.name} updated successfully!`);
      } else {
        alert(
          "Failed to update payment method: " +
          (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error updating payment method:", err);
      alert(
        "Failed to update payment method: " +
        (err.response?.data?.message || "Please try again.")
      );
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl font-semibold text-neutral-800">
          Payment Method
        </h1>
        <div className="text-sm text-neutral-600">
          <span className="text-teal-600 hover:text-teal-700 cursor-pointer">
            Home
          </span>
          <span className="mx-2">/</span>
          <span className="text-neutral-800">Payment Method</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mr-2"></div>
          <span className="text-neutral-600">Loading payment methods...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Payment Methods Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {paymentMethods.map((method) => (
            <div
              key={method._id}
              className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="bg-teal-600 px-4 sm:px-6 py-3">
                <h2 className="text-white text-lg font-semibold">
                  {method.name}
                </h2>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4">
                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-neutral-800 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={method.description}
                    onChange={(e) =>
                      handleUpdate(method._id, "description", e.target.value)
                    }
                    disabled={updating === method._id}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* API Key (if applicable) */}
                {method.hasApiKeys && (
                  <div>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">
                      API Key/ Client Id/ Public Key
                    </label>
                    <input
                      type="text"
                      value={method.apiKey || ""}
                      onChange={(e) =>
                        handleUpdate(method._id, "apiKey", e.target.value)
                      }
                      disabled={updating === method._id}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Secret Key (if applicable) */}
                {method.hasApiKeys && (
                  <div>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">
                      Secret Key/ Client Secret
                    </label>
                    <input
                      type="password"
                      value={method.secretKey || ""}
                      onChange={(e) =>
                        handleUpdate(method._id, "secretKey", e.target.value)
                      }
                      disabled={updating === method._id}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-sm font-bold text-neutral-800 mb-2">
                    Status
                  </label>
                  <select
                    value={method.status}
                    onChange={(e) =>
                      handleStatusChange(
                        method._id,
                        e.target.value as "Active" | "InActive"
                      )
                    }
                    disabled={updating === method._id}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-neutral-100 disabled:cursor-not-allowed">
                    <option value="Active">Active</option>
                    <option value="InActive">InActive</option>
                  </select>
                </div>

                {/* Update Button */}
                <button
                  onClick={() => handleUpdatePaymentMethod(method._id)}
                  disabled={updating === method._id}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded text-sm font-medium transition-colors flex items-center justify-center">
                  {updating === method._id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    "Update Payment Method"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-teal-600 hover:text-teal-700">
          Olovely Total Suvidha
        </a>
      </div>
    </div>
  );
}

