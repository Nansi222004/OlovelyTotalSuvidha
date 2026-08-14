import api from "../config";


import { ApiResponse } from "./types";

export interface Notification {
  _id: string;
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
  recipientId?: string;
  title: string;
  message: string;
  type:
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "Order"
  | "Payment"
  | "System";
  link?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  expiresAt?: string;
  createdBy?: string | { firstName: string; lastName: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNotificationData {
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
  recipientId?: string;
  title: string;
  message: string;
  type?:
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "Order"
  | "Payment"
  | "System";
  link?: string;
  actionLabel?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  expiresAt?: string;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  recipientType?: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
  recipientId?: string;
  isRead?: boolean;
  type?:
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "Order"
  | "Payment"
  | "System";
  priority?: "Low" | "Medium" | "High" | "Urgent";
}

export interface MarkMultipleAsReadData {
  notificationIds: string[];
}

/**
 * Create a new notification
 */
export const createNotification = async (
  data: CreateNotificationData
): Promise<ApiResponse<Notification>> => {
  const response = await api.post<ApiResponse<Notification>>(
    "/admin/notifications",
    data
  );
  return response.data;
};

/**
 * Get all notifications
 */
export const getNotifications = async (
  params?: GetNotificationsParams
): Promise<ApiResponse<Notification[]>> => {
  const response = await api.get<ApiResponse<Notification[]>>(
    "/admin/notifications",
    { params }
  );
  return response.data;
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (
  id: string
): Promise<ApiResponse<Notification>> => {
  const response = await api.get<ApiResponse<Notification>>(
    `/admin/notifications/${id}`
  );
  return response.data;
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  id: string
): Promise<ApiResponse<Notification>> => {
  const response = await api.patch<ApiResponse<Notification>>(
    `/admin/notifications/${id}/read`
  );
  return response.data;
};

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (
  data: MarkMultipleAsReadData
): Promise<ApiResponse<{ modified: number }>> => {
  const response = await api.patch<ApiResponse<{ modified: number }>>(
    "/admin/notifications/mark-read",
    data
  );
  return response.data;
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  id: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(
    `/admin/notifications/${id}`
  );
  return response.data;
};
