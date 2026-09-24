import mongoose from "mongoose";
import Order from "../../models/Order";
import Customer from "../../models/Customer";
import AppSettings, { IAppSettings } from "../../models/AppSettings";

/**
 * Determine whether a customer is eligible for First Order Free Shipping.
 *
 * Business Rules:
 * 1. Must be authoritatively determined by the backend from authenticated customer identity.
 * 2. A customer is eligible ONLY if:
 *    a) Their customer-level atomic promotion reservation flag (firstOrderFreeShippingConsumed) is not true.
 *    b) They have not previously placed/completed an eligible order.
 * 3. Excludes:
 *    - Failed payment attempts (paymentStatus === 'Failed')
 *    - Abandoned carts / incomplete checkout sessions (orders initiated online with status === 'Pending' & paymentStatus === 'Pending' that were never paid)
 *    - Cancelled orders (status === 'Cancelled')
 *    - Rejected orders (status === 'Rejected')
 * 4. Counts:
 *    - Any order with paymentStatus === 'Paid'
 *    - Any confirmed COD order (paymentMethod === 'COD' with status in active or completed fulfillment states)
 *    - Any wallet-paid order
 * 5. Returns false if customer has already claimed or placed any eligible order.
 */
export const isCustomerEligibleForFirstOrderFreeShipping = async (
  customerId: string | mongoose.Types.ObjectId | undefined | null,
  session?: mongoose.ClientSession | null
): Promise<boolean> => {
  if (!customerId) return false;

  const customerObjId = new mongoose.Types.ObjectId(customerId.toString());

  // Check 1: Customer-level atomic reservation flag
  const custQuery = Customer.findById(customerObjId).select("firstOrderFreeShippingConsumed");
  if (session) {
    custQuery.session(session);
  }
  const customer = await custQuery.lean();
  if (customer?.firstOrderFreeShippingConsumed) {
    return false;
  }

  // Check 2: Authoritative historical order query
  const orderQuery = Order.findOne({
    customer: customerObjId,
    status: { $nin: ["Cancelled", "Rejected"] },
    $or: [
      { paymentStatus: "Paid" },
      {
        paymentMethod: "COD",
        status: {
          $in: [
            "Received",
            "Accepted",
            "Processed",
            "Shipped",
            "Picked up",
            "On the way",
            "Out for Delivery",
            "Delivered",
          ],
        },
      },
      {
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
      },
    ],
    paymentStatus: { $ne: "Failed" },
  }).select("_id orderNumber status paymentStatus paymentMethod createdAt");

  if (session) {
    orderQuery.session(session);
  }

  const priorEligibleOrder = await orderQuery.lean();

  return !priorEligibleOrder;
};

/**
 * Atomically claim/reserve the first-order free shipping benefit for a customer.
 * Uses an atomic condition: firstOrderFreeShippingConsumed: { $ne: true }.
 * If two concurrent checkout requests hit this simultaneously, exactly ONE will find
 * the document matching $ne: true and flip it to true; the second will match 0 documents
 * and return null (false).
 */
export const atomicallyClaimFirstOrderFreeShipping = async (
  customerId: string | mongoose.Types.ObjectId | undefined | null,
  session?: mongoose.ClientSession | null
): Promise<boolean> => {
  if (!customerId) return false;

  const customerObjId = new mongoose.Types.ObjectId(customerId.toString());

  const options: mongoose.QueryOptions = { new: true };
  if (session) {
    options.session = session;
  }

  const updatedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customerObjId,
      firstOrderFreeShippingConsumed: { $ne: true },
    },
    {
      $set: { firstOrderFreeShippingConsumed: true },
    },
    options
  );

  return Boolean(updatedCustomer);
};

/**
 * Safely release/revert the first-order free shipping claim for a customer.
 * Used when:
 * 1. An order creation attempt fails or aborts before completion.
 * 2. An order that received the promotion is subsequently Cancelled or Rejected.
 * 3. An online payment fails.
 */
export const releaseFirstOrderFreeShippingClaim = async (
  customerId: string | mongoose.Types.ObjectId | undefined | null,
  session?: mongoose.ClientSession | null
): Promise<boolean> => {
  if (!customerId) return false;

  const customerObjId = new mongoose.Types.ObjectId(customerId.toString());

  const options = session ? { session } : undefined;

  await Customer.updateOne(
    { _id: customerObjId },
    { $set: { firstOrderFreeShippingConsumed: false } },
    options
  );

  return true;
};

export interface FirstOrderShippingEvaluation {
  isFeatureEnabled: boolean;
  isEligible: boolean;
  applied: boolean;
  normalShippingAmount: number;
  shippingDiscount: number;
  finalShippingAmount: number;
}

/**
 * Normal Shipping Calculation -> First Order Promotion Check -> Result
 *
 * Strictly enforces:
 * - Admin First Order Free Shipping setting must be enabled.
 * - Customer must be eligible (no previous completed/placed order and benefit not consumed).
 * - Client cannot override or force free shipping.
 */
export const evaluateFirstOrderFreeShipping = async (params: {
  customerId: string | mongoose.Types.ObjectId | undefined | null;
  settings?: IAppSettings | null;
  normalShippingFee: number;
  session?: mongoose.ClientSession | null;
}): Promise<FirstOrderShippingEvaluation> => {
  const normalShippingAmount = Math.max(0, Number(params.normalShippingFee) || 0);
  const isFeatureEnabled = Boolean(params.settings?.firstOrderFreeShippingEnabled);

  if (!isFeatureEnabled || !params.customerId) {
    return {
      isFeatureEnabled,
      isEligible: false,
      applied: false,
      normalShippingAmount,
      shippingDiscount: 0,
      finalShippingAmount: normalShippingAmount,
    };
  }

  const isEligible = await isCustomerEligibleForFirstOrderFreeShipping(
    params.customerId,
    params.session
  );

  if (!isEligible) {
    return {
      isFeatureEnabled,
      isEligible: false,
      applied: false,
      normalShippingAmount,
      shippingDiscount: 0,
      finalShippingAmount: normalShippingAmount,
    };
  }

  // Customer is eligible and feature is ON:
  // If normalShippingAmount is already 0 (e.g. met freeDeliveryThreshold), no discount needed
  const shippingDiscount = normalShippingAmount;
  const finalShippingAmount = 0;
  const applied = normalShippingAmount > 0;

  return {
    isFeatureEnabled,
    isEligible: true,
    applied,
    normalShippingAmount,
    shippingDiscount,
    finalShippingAmount,
  };
};

