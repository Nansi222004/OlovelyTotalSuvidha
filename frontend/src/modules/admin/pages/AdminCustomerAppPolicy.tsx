import { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';
import { getPolicies, createPolicy, updatePolicy, Policy } from '../../../services/api/admin/adminContentService';

export default function AdminCustomerAppPolicy() {
  const { showToast } = useToast();
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [policyContent, setPolicyContent] = useState(`Welcome to Olovely Total Suvidha - 10 Minute App!

By using our customer app, you agree to the following terms and conditions:

1. Account Registration
   - You must provide accurate and complete information when creating an account
   - You are responsible for maintaining the confidentiality of your account credentials
   - You must notify us immediately of any unauthorized use of your account

2. Order Placement
   - All orders are subject to product availability
   - Prices are subject to change without notice
   - We reserve the right to refuse or cancel any order

3. Payment Terms
   - Payment must be made at the time of order placement
   - We accept various payment methods as displayed in the app
   - All prices are inclusive of applicable taxes

4. Delivery
   - Delivery times are estimates and may vary
   - We are not responsible for delays due to circumstances beyond our control
   - You must be available to receive the delivery at the specified address

5. Returns and Refunds
   - Returns are accepted within 7 days of delivery
   - Products must be in original condition and packaging
   - Refunds will be processed within 5-7 business days

6. Privacy
   - We respect your privacy and handle your data in accordance with our Privacy Policy
   - Your personal information will not be shared with third parties without consent

7. Limitation of Liability
   - Our liability is limited to the value of the products purchased
   - We are not liable for any indirect or consequential damages

8. Changes to Terms
   - We reserve the right to modify these terms at any time
   - Continued use of the app constitutes acceptance of modified terms

For any questions or concerns, please contact our customer support team.

Last updated: December 2025`);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        const response = await getPolicies({ type: 'customer' });
        if (response.success && response.data && response.data.length > 0) {
          const fetchedPolicy: Policy = response.data[0];
          setPolicyId(fetchedPolicy._id);
          setPolicyContent(fetchedPolicy.content);
        }
      } catch (err) {
        console.error("Failed to fetch customer policy:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyContent.trim()) {
      showToast('Policy text cannot be empty', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (policyId) {
        const response = await updatePolicy(policyId, {
          title: "Customer App Policy",
          content: policyContent.trim(),
          version: "1.0",
          isActive: true,
        });
        if (response.success) {
          showToast('Customer App Policy updated successfully!', 'success');
        } else {
          showToast(response.message || 'Failed to update policy', 'error');
        }
      } else {
        const response = await createPolicy({
          type: "customer",
          title: "Customer App Policy",
          content: policyContent.trim(),
          version: "1.0",
          isActive: true,
        });
        if (response.success && response.data) {
          setPolicyId(response.data._id);
          showToast('Customer App Policy created successfully!', 'success');
        } else {
          showToast(response.message || 'Failed to create policy', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error updating policy', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Customer App Policy</h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-blue-600">Home</span> / <span className="text-neutral-900">Customer App Policy</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Policy Content Section */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              <div className="bg-teal-600 px-4 sm:px-6 py-3">
                <h2 className="text-white text-lg font-semibold">Policy Content</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-800 mb-2">
                    Policy Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="policyContent"
                    value={policyContent}
                    onChange={(e) => setPolicyContent(e.target.value)}
                    placeholder="Enter Customer App Policy content..."
                    rows={25}
                    required
                    className="w-full px-4 py-3 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y font-mono"
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    You can format the policy content using plain text. Use line breaks and spacing to organize the content.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              <div className="bg-teal-600 px-4 sm:px-6 py-3">
                <h2 className="text-white text-lg font-semibold">Preview</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-neutral-700 bg-neutral-50 p-4 rounded border border-neutral-200 min-h-[200px] max-h-[400px] overflow-y-auto">
                    {policyContent || 'Policy content will appear here...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setPolicyContent('')}
                className="px-6 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2.5 rounded-lg text-base font-medium transition-colors"
              >
                Update Policy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


