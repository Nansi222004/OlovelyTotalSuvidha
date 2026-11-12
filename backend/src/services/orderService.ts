import Order from "../models/Order";
import { IOrderItem } from "../models/OrderItem";
import Inventory from "../models/Inventory";
import { clearOrderCache } from "../socket/socketService";

/**
 * Process order status transition
 */
export const processOrderStatusTransition = async (
  orderId: string,
  newStatus: string,
  previousStatus: string
) => {
  const order = await Order.findById(orderId).populate("items");

  if (!order) {
    throw new Error("Order not found");
  }

  // Clear tracking cache if order is completed, cancelled, or rejected
  if (["Delivered", "Cancelled", "Returned", "Failed", "Rejected"].includes(newStatus)) {
    clearOrderCache(orderId);
  }

  // Handle status-specific logic
  switch (newStatus) {
    case "Cancelled":
      // Restore inventory if order was confirmed
      if (["Processed", "Shipped"].includes(previousStatus)) {
        await restoreInventory(order.items as any[]);
      }
      break;

    case "Processed":
      // Reserve inventory
      await reserveInventory(order.items as any[]);
      break;

    case "Delivered":
      // Create commissions for sellers
      await createCommissions(order.items as any[]);
      break;
  }

  return order;
};

/**
 * Reserve inventory for order items
 */
const reserveInventory = async (items: IOrderItem[]) => {
  for (const item of items) {
    const inventory = await Inventory.findOne({ product: item.product });
    if (inventory) {
      inventory.reservedStock += item.quantity;
      inventory.availableStock = Math.max(
        0,
        inventory.currentStock - inventory.reservedStock
      );
      await inventory.save();
    }
  }
};

/**
 * Restore inventory when order is cancelled
 */
const restoreInventory = async (items: IOrderItem[]) => {
  for (const item of items) {
    const inventory = await Inventory.findOne({ product: item.product });
    if (inventory) {
      inventory.reservedStock = Math.max(
        0,
        inventory.reservedStock - item.quantity
      );
      inventory.availableStock =
        inventory.currentStock - inventory.reservedStock;
      await inventory.save();
    }
  }
};

/**
 * Create commissions for sellers when order is delivered
 * Also updates seller balances and creates wallet transactions
 */
/**
 * Create commissions for sellers when order is delivered
 * Now delegating to commissionService.distributeCommissions
 */
const createCommissions = async (items: IOrderItem[]) => {
  if (!items || items.length === 0) return;

  try {
    const orderId = items[0].order.toString();
    const order = await Order.findById(orderId);

    if (!order) return;

    // One idempotent hook for all payment methods / channels (see commissionService)
    const { recordDeliveryFinancials } = await import("./commissionService");
    const res: any = await recordDeliveryFinancials(orderId);
    if (res && res.success === false) console.error(`Delivery financials failed for order ${orderId}: ${res.message}`);
  } catch (err) {
    console.error("Error creating commissions in orderService:", err);
    throw err;
  }
};


/**
 * Validate order can transition to new status
 */
export const validateStatusTransition = (
  currentStatus: string,
  newStatus: string
): { valid: boolean; message?: string } => {
  const validTransitions: Record<string, string[]> = {
    Received: ["Pending", "Cancelled", "Rejected"],
    Pending: ["Processed", "Cancelled", "Rejected"],
    Processed: ["Shipped", "Cancelled", "Rejected"],
    Shipped: ["Out for Delivery", "Cancelled", "Rejected"],
    "Out for Delivery": ["Delivered", "Cancelled", "Rejected"],
    Delivered: ["Returned"],
    Cancelled: [],
    Rejected: [],
    Returned: [],
  };

  const allowedStatuses = validTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      message: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${allowedStatuses.join(
        ", "
      )}`,
    };
  }

  return { valid: true };
};

// R-14: calculateOrderTotals (hardcoded 18% exclusive GST + ₹50 shipping, contradicting checkout) removed; it had no callers.
