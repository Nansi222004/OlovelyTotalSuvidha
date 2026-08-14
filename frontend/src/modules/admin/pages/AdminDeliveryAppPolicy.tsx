import { useState } from 'react';

export default function AdminDeliveryAppPolicy() {
  const [policyContent, setPolicyContent] = useState(`Welcome to Olovely Total Suvidha - 10 Minute App Delivery Partner Program!

By using our delivery app, you agree to the following terms and conditions:

1. Delivery Partner Registration
   - You must provide accurate and complete information during registration
   - You must have a valid driver's license and vehicle registration
   - Background checks may be required before approval
   - You are responsible for maintaining the confidentiality of your account credentials

2. Delivery Responsibilities
   - You must accept and complete deliveries in a timely manner
   - You must handle all orders with care and ensure product integrity
   - You must follow the delivery route provided by the app
   - You must obtain customer signature or confirmation upon delivery

3. Vehicle and Equipment Requirements
   - You must maintain a valid driver's license and vehicle insurance
   - Your vehicle must be in good working condition
   - You must have a smartphone with GPS capabilities
   - You must maintain proper delivery equipment (bags, containers, etc.)

4. Payment and Earnings
   - Delivery fees are calculated based on distance and order value
   - Earnings are credited to your account after successful delivery
   - Payment is processed weekly via your registered payment method
   - You are responsible for reporting your earnings for tax purposes

5. Code of Conduct
   - You must treat customers with respect and professionalism
   - You must maintain a clean and presentable appearance
   - You must not engage in any illegal activities
   - You must follow all traffic laws and regulations

6. Safety Requirements
   - You must prioritize safety at all times
   - You must not use your phone while driving
   - You must wear appropriate safety gear when required
   - You must report any accidents or incidents immediately

7. Availability and Scheduling
   - You can set your own availability through the app
   - You must honor accepted delivery assignments
   - Cancellation of accepted orders may result in penalties
   - You must maintain a minimum acceptance rate to remain active

8. Ratings and Reviews
   - Customers may rate your service after delivery
   - Low ratings may affect your access to delivery opportunities
   - You can view and respond to customer feedback
   - Maintaining high ratings is important for continued partnership

9. Termination
   - We reserve the right to suspend or terminate your account for violations
   - Violations include but are not limited to: fraud, theft, unprofessional conduct
   - You may terminate your partnership at any time with proper notice

10. Privacy and Data
    - We respect your privacy and handle your data in accordance with our Privacy Policy
    - Your location data is used only for delivery purposes
    - Your personal information will not be shared with customers

11. Limitation of Liability
    - You are an independent contractor, not an employee
    - You are responsible for your own taxes and insurance
    - We are not liable for accidents or incidents during deliveries

12. Changes to Terms
    - We reserve the right to modify these terms at any time
    - Continued use of the app constitutes acceptance of modified terms
    - You will be notified of significant changes via the app or email

For any questions or concerns, please contact our delivery partner support team.

Last updated: January 2025`);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    alert('Delivery App Policy updated successfully!');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Delivery App Policy</h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-blue-600">Home</span> / <span className="text-neutral-900">Delivery App Policy</span>
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
                    placeholder="Enter Delivery App Policy content..."
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


