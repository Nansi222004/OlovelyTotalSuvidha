import { useState } from 'react';

interface SmsGateway {
  id: string;
  name: string;
  fields: {
    [key: string]: string;
  };
  status: 'Active' | 'InActive';
}

export default function AdminSmsGateway() {
  const [gateways, setGateways] = useState<SmsGateway[]>([
    {
      id: 'smsindiahub',
      name: 'SMS India HUB',
      fields: {
        username: '',
        apiKey: '',
        senderId: '',
        dltTemplateId: '',
      },
      status: 'InActive',
    },
  ]);

  const handleFieldChange = (gatewayId: string, fieldName: string, value: string) => {
    setGateways((prev) =>
      prev.map((gateway) =>
        gateway.id === gatewayId
          ? {
            ...gateway,
            fields: {
              ...gateway.fields,
              [fieldName]: value,
            },
          }
          : gateway
      )
    );
  };

  const handleStatusChange = (gatewayId: string, status: 'Active' | 'InActive') => {
    setGateways((prev) =>
      prev.map((gateway) => (gateway.id === gatewayId ? { ...gateway, status } : gateway))
    );
  };

  const handleUpdate = (gatewayId: string) => {
    const gateway = gateways.find((g) => g.id === gatewayId);
    if (gateway) {
      // Handle update logic here
      console.log('Updating gateway:', gateway);
      alert(`${gateway.name} configuration updated successfully!`);
    }
  };

  const getFieldLabel = (fieldName: string): string => {
    const labelMap: { [key: string]: string } = {
      accountSid: 'AccountSid',
      authToken: 'Auth Token',
      twilioNumber: 'TwilioNumber',
      message: 'Message',
      vonageApiKey: 'VonageApiKey',
      vonageApiSecret: 'VonageApiSecret',
      smsSenderId: 'SmsSenderId',
      messageText: 'Message Text',
      apiKey: 'API Key',
      otpTemplateName: 'Otp Template Name',
      otpTemplateId: 'OtpTemplateId',
      authKey: 'AuthKey',
      senderId: 'Sender ID',
      messageId: 'Message Id',
      username: 'Username',
      dltTemplateId: 'DLT Template ID',
    };
    return labelMap[fieldName] || fieldName;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">SMS Gateway</h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-blue-600">Home</span> / <span className="text-neutral-900">SMS Gateway</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="bg-teal-600 px-4 sm:px-6 py-3">
                <h2 className="text-white text-lg font-semibold">{gateway.name}</h2>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4">
                {/* Fields */}
                {Object.entries(gateway.fields).map(([fieldName, fieldValue]) => (
                  <div key={fieldName}>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">
                      {getFieldLabel(fieldName)}
                    </label>
                    <input
                      type={fieldName.includes('Token') || fieldName.includes('Secret') || fieldName.includes('authKey') || fieldName.includes('apiKey') ? 'password' : 'text'}
                      value={fieldValue}
                      onChange={(e) => handleFieldChange(gateway.id, fieldName, e.target.value)}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder={fieldValue === '' ? `Enter ${getFieldLabel(fieldName)}` : ''}
                    />
                  </div>
                ))}

                {/* Status */}
                <div>
                  <label className="block text-sm font-bold text-neutral-800 mb-2">Status</label>
                  <select
                    value={gateway.status}
                    onChange={(e) => handleStatusChange(gateway.id, e.target.value as 'Active' | 'InActive')}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="Active">Active</option>
                    <option value="InActive">InActive</option>
                  </select>
                </div>

                {/* Update Button */}
                <div className="pt-2">
                  <button
                    onClick={() => handleUpdate(gateway.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded font-medium transition-colors"
                  >
                    Update SMS Gateway
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

