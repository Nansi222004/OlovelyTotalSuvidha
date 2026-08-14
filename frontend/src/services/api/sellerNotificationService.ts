import api from "./config";

export interface SellerNotification {
  _id: string;
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
  recipientId?: string;
  title: string;
  message: string;
  type: "Info" | "Success" | "Warning" | "Error" | "Order" | "Payment" | "System";
  link?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  expiresAt?: string;
  createdAt?: string;
}

const BASE_URL = "/seller";

export const getSellerNotifications = async () => {
  const response = await api.get(`${BASE_URL}/notifications`);
  return response.data.data as SellerNotification[];
};

export const markSellerNotificationRead = async (id: string) => {
  const response = await api.put(`${BASE_URL}/notifications/${id}/read`);
  return response.data;
};

