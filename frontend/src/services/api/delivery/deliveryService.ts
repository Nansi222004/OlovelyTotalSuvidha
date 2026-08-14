import api from "../config";

const handleApiError = (error: any) => {
  if (error.response && error.response.data && error.response.data.message) {
    throw new Error(error.response.data.message);
  }
  throw new Error(error.message || "An unexpected error occurred");
};

const BASE_URL = "/delivery";

export interface DeliveryDashboardStats {
  dailyCollection: number; // Cash to be deposited
  cashBalance: number; // Total cash holding
  pendingOrders: number;
  allOrders: number;
  returnOrders: number;
  returnItems: number;
  todayEarning: number;
  totalEarning: number;
  walletBalance: number;
  todayDeliveredCount: number;
  totalDeliveredCount: number;
  pendingOrdersList: any[]; // Define stricter type if needed
}

// --- Dashboard ---
export const getDashboardStats = async (): Promise<DeliveryDashboardStats> => {
  try {
    const response = await api.get(`${BASE_URL}/dashboard/stats`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// --- Orders ---

export const updateSettings = async (settings: {
  notifications?: boolean;
  location?: boolean;
  sound?: boolean;
}) => {
  const response = await api.put("/delivery/settings", settings);
  return response.data;
};

export const getAllOrdersHistory = async (page = 1, limit = 20) => {
  const response = await api.get(
    `/delivery/orders/history?page=${page}&limit=${limit}`,
  );
  return response.data.data;
};

export const getTodayOrders = async () => {
  const response = await api.get("/delivery/orders/today");
  return response.data.data;
};

export const getReturnOrders = async () => {
  const response = await api.get("/delivery/orders/returns");
  return response.data.data;
};

export const getPendingOrders = async () => {
  const response = await api.get("/delivery/orders/pending");
  return response.data.data;
};

export const getPendingOrderAlerts = async () => {
  const response = await api.get("/delivery/orders/pending-alerts");
  return response.data.data;
};

export const getOrderDetails = async (id: string) => {
  try {
    const response = await api.get(`${BASE_URL}/orders/${id}`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const updateOrderStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`${BASE_URL}/orders/${id}/status`, {
      status,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSellerLocationsForOrder = async (id: string) => {
  try {
    const response = await api.get(`${BASE_URL}/orders/${id}/seller-locations`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const sendDeliveryOtp = async (id: string) => {
  try {
    const response = await api.post(
      `${BASE_URL}/orders/${id}/send-delivery-otp`,
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const verifyDeliveryOtp = async (id: string, otp: string) => {
  try {
    const response = await api.post(
      `${BASE_URL}/orders/${id}/verify-delivery-otp`,
      { otp },
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const checkSellerProximity = async (
  orderId: string,
  sellerId: string,
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.post(
      `${BASE_URL}/orders/${orderId}/check-seller-proximity`,
      {
        sellerId,
        latitude,
        longitude,
      },
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const confirmSellerPickup = async (
  orderId: string,
  sellerId: string,
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.post(
      `${BASE_URL}/orders/${orderId}/confirm-seller-pickup`,
      {
        sellerId,
        latitude,
        longitude,
      },
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const checkCustomerProximity = async (
  orderId: string,
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.post(
      `${BASE_URL}/orders/${orderId}/check-customer-proximity`,
      {
        latitude,
        longitude,
      },
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// --- Tracking ---
export const updateGeneralLocation = async (
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.post(`${BASE_URL}/location/general`, {
      latitude,
      longitude,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSellersInRadius = async (
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.get(`${BASE_URL}/location/sellers-in-radius`, {
      params: { latitude, longitude },
    });
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const updateDeliveryLocation = async (
  orderId: string,
  latitude: number,
  longitude: number,
) => {
  try {
    const response = await api.post("/delivery/location", {
      orderId,
      latitude,
      longitude,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// --- Earnings ---
export const getEarningsHistory = async () => {
  try {
    const response = await api.get(`${BASE_URL}/earnings`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const requestWithdrawal = async (amount?: number) => {
  try {
    const response = await api.post(`${BASE_URL}/withdraw`, { amount });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// --- Profile ---
export const getDeliveryProfile = async () => {
  try {
    const response = await api.get(`${BASE_URL}/profile`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// --- Help & Support ---
export const getHelpSupport = async () => {
  try {
    const response = await api.get(`${BASE_URL}/help`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const updateProfile = async (data: any) => {
  try {
    const response = await api.put(`${BASE_URL}/profile`, data);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const updateStatus = async (isOnline: boolean) => {
  try {
    const response = await api.put(`${BASE_URL}/status`, { isOnline });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getNotifications = async () => {
  try {
    const response = await api.get(`${BASE_URL}/notifications`);
    return response.data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const markNotificationRead = async (id: string) => {
  try {
    const response = await api.put(`${BASE_URL}/notifications/${id}/read`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};
