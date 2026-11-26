import AppSettings from "../models/AppSettings";
import { computeDistanceRiderPay } from "./riderPayService";

/**
 * Calculate estimated delivery boy earning for a new order.
 */
export async function calculateEstimatedDeliveryBoyEarning(order: any): Promise<number> {
  try {
    // @ts-ignore - getSettings is a static method
    const settings = await AppSettings.getSettings();

    const distancePay = computeDistanceRiderPay(settings?.deliveryConfig, order.deliveryDistanceKm);
    if (distancePay !== null) return distancePay;

    const defaultCommissionRate = 5;
    const earning = (order.subtotal * defaultCommissionRate) / 100;
    return Math.round(earning * 100) / 100;
  } catch (error) {
    console.error("Error calculating estimated delivery boy earning:", error);
    return Math.round(((order.subtotal * 5) / 100) * 100) / 100;
  }
}
