import api from './config';

export interface PincodeServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  estimatedDays?: number;
  channel: string;
  fulfillmentType: string;
  provider?: string;
  testPricingDefaults?: {
    standardShippingFee: number;
    freeShippingThreshold: number;
    note: string;
  };
}

export interface TrackingActivity {
  status: string;
  timestamp: string;
  location?: string;
  description: string;
}

export interface TrackingResult {
  trackingNumber: string;
  currentStatus: string;
  carrier: string;
  estimatedDeliveryDate?: string;
  activities: TrackingActivity[];
}

export const checkPincodeServiceability = async (pincode: string): Promise<{ success: boolean; data?: PincodeServiceabilityResult; message?: string }> => {
  try {
    const response = await api.get(`/customer/shipping/serviceability?pincode=${encodeURIComponent(pincode)}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to check pincode serviceability',
    };
  }
};

export const getShippingTracking = async (trackingNumber: string): Promise<{ success: boolean; data?: TrackingResult; message?: string }> => {
  try {
    const response = await api.get(`/customer/shipping/tracking/${encodeURIComponent(trackingNumber)}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch tracking details',
    };
  }
};
