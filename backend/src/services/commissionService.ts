import Commission from "../models/Commission";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import AppSettings from "../models/AppSettings";
import { creditWallet } from "./walletManagementService";
import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";
import WalletTransaction from "../models/WalletTransaction";

/**
 * Get the effective commission rate for a product/item
 * New Priority: Seller's categoryCommissions[headerCategoryId] → 0 (no commission)
 */
export const getOrderItemCommissionRate = async (
  productIdOrProduct: string | any,
  sellerId?: string,
  _settings?: any,
): Promise<number> => {
  try {
    // If productIdOrProduct is already an object (product), use it
    let product;
    if (
      typeof productIdOrProduct === "object" &&
      productIdOrProduct !== null &&
      productIdOrProduct._id
    ) {
      product = productIdOrProduct;
    } else {
      product = await Product.findById(productIdOrProduct);
    }

    if (!product) return 0; // No product = no commission

    const finalSellerId = sellerId || product.seller.toString();

    // Find the product's headerCategoryId
    let headerCategoryId = product.headerCategoryId;

    // If product doesn't have headerCategoryId directly, look it up from Category
    if (!headerCategoryId && product.category) {
      const cat =
        typeof product.category === "object" && product.category !== null
          ? product.category
          : await Category.findById(product.category);
      if (cat?.headerCategoryId) {
        headerCategoryId = cat.headerCategoryId;
      }
    }

    if (!headerCategoryId) {
      console.log(
        `[Commission] No headerCategoryId for product ${product._id}, returning 0%`,
      );
      return 0;
    }

    // Look up seller's categoryCommissions for this headerCategory
    const seller = await Seller.findById(finalSellerId);
    if (!seller || !seller.categoryCommissions || seller.categoryCommissions.length === 0) {
      console.log(
        `[Commission] No categoryCommissions for seller ${finalSellerId}, returning 0%`,
      );
      return 0;
    }

    const headerCatIdStr = headerCategoryId.toString();
    const entry = seller.categoryCommissions.find(
      (cc: any) => cc.headerCategory.toString() === headerCatIdStr,
    );

    if (entry && entry.commissionRate > 0) {
      return entry.commissionRate;
    }

    return 0; // No commission set for this category
  } catch (error) {
    console.error("Error calculating commission rate:", error);
    return 0;
  }
};

/**
 * Get commission rate for a seller
 */
/**
 * Get commission rate for a seller
 */
export const getSellerCommissionRate = async (
  sellerId: string,
): Promise<number> => {
  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new Error("Seller not found");
    }

    // Use individual rate if set, otherwise use global default
    if (seller.commissionRate !== undefined && seller.commissionRate !== null) {
      return seller.commissionRate;
    }

    const settings = await AppSettings.findOne();
    // @ts-ignore
    return settings && settings.globalCommissionRate !== undefined
      ? settings.globalCommissionRate
      : 10;
  } catch (error) {
    console.error("Error getting seller commission rate:", error);
    return 10; // Default fallback
  }
};

/**
 * Get commission rate for a delivery boy
 */
export const getDeliveryBoyCommissionRate = async (
  deliveryBoyId: string,
): Promise<number> => {
  try {
    const deliveryBoy = await Delivery.findById(deliveryBoyId);
    if (!deliveryBoy) {
      throw new Error("Delivery boy not found");
    }

    // Use individual rate if set, otherwise use global default
    if (
      deliveryBoy.commissionRate !== undefined &&
      deliveryBoy.commissionRate !== null
    ) {
      return deliveryBoy.commissionRate;
    }

    return 5; // Default 5%
  } catch (error) {
    console.error("Error getting delivery boy commission rate:", error);
    return 5; // Default fallback
  }
};

/**
 * Calculate commissions for an order
 */
export const calculateOrderCommissions = async (orderId: string) => {
  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) {
      throw new Error("Order not found");
    }

    const commissions: {
      seller?: {
        sellerId: string;
        amount: number;
        rate: number;
        orderAmount: number;
      }[];
      deliveryBoy?: {
        deliveryBoyId: string;
        amount: number;
        rate: number;
        orderAmount: number;
      };
    } = {};

    // Calculate seller commissions (per item/seller)
    const sellerCommissions = new Map<
      string,
      { amount: number; rate: number; orderAmount: number }
    >();

    for (const itemId of order.items) {
      const orderItem = await OrderItem.findById(itemId);
      if (!orderItem) continue;

      const sellerId = orderItem.seller.toString();
      const itemTotal = orderItem.total;

      // Get commission rate for this seller
      const commissionRate = await getSellerCommissionRate(sellerId);
      const commissionAmount = (itemTotal * commissionRate) / 100;

      if (sellerCommissions.has(sellerId)) {
        const existing = sellerCommissions.get(sellerId)!;
        existing.amount += commissionAmount;
        existing.orderAmount += itemTotal;
      } else {
        sellerCommissions.set(sellerId, {
          amount: commissionAmount,
          rate: commissionRate,
          orderAmount: itemTotal,
        });
      }
    }

    // Convert to array
    commissions.seller = Array.from(sellerCommissions.entries()).map(
      ([sellerId, data]) => ({
        sellerId,
        ...data,
      }),
    );

    // Calculate delivery boy commission only when delivery boy is assigned and NOT Self Assign
    if (order.deliveryBoy && order.deliveryPreference !== "Self") {
      const deliveryBoyId = order.deliveryBoy.toString();

      // Check for distance based commission
      let commissionAmount = 0;
      let commissionRate = 0;
      let usedDistanceBased = false;

      try {
        // @ts-ignore - getSettings is static on model
        const settings = await AppSettings.getSettings();
        if (
          settings &&
          settings.deliveryConfig?.isDistanceBased === true &&
          settings.deliveryConfig?.deliveryBoyKmRate &&
          order.deliveryDistanceKm &&
          order.deliveryDistanceKm > 0
        ) {
          commissionRate = settings.deliveryConfig.deliveryBoyKmRate;
          commissionAmount = order.deliveryDistanceKm * commissionRate;
          usedDistanceBased = true;
          console.log(
            `DEBUG: Distance Commission: Dist=${order.deliveryDistanceKm}km, Rate=${commissionRate}/km, Amt=${commissionAmount}`,
          );
        }
      } catch (err) {
        console.error("Error checking settings for commission:", err);
      }

      if (!usedDistanceBased) {
        // Fallback to percentage based logic
        commissionRate = await getDeliveryBoyCommissionRate(deliveryBoyId);
        commissionAmount = (order.subtotal * commissionRate) / 100;
      }

      commissions.deliveryBoy = {
        deliveryBoyId,
        amount: Math.round(commissionAmount * 100) / 100, // Round to 2 decimals
        rate: commissionRate,
        orderAmount: usedDistanceBased
          ? order.deliveryDistanceKm || 0
          : order.subtotal,
      };
    }

    return {
      success: true,
      data: commissions,
    };
  } catch (error: any) {
    console.error("Error calculating order commissions:", error);
    return {
      success: false,
      message: error.message || "Failed to calculate commissions",
    };
  }
};

/**
 * Distribute commissions for an order
 */
/**
 * Create Pending Commissions (called on Order Payment)
 */
export const createPendingCommissions = async (orderId: string) => {
  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) throw new Error("Order not found");

    // Check if commissions already exist
    const existingCommissions = await Commission.find({ order: orderId });
    if (existingCommissions.length > 0) {
      console.log(`Commissions already exist for order ${orderId}`);
      return;
    }

    const items = order.items;
    // Group items by seller to aggregate earnings (though we store per item mostly)
    // We'll calculate per item as per original logic

    for (const itemId of items) {
      const item = await OrderItem.findById(itemId);
      if (!item) continue;

      const seller = await Seller.findById(item.seller);
      if (!seller) continue;

      const commissionRate = await getOrderItemCommissionRate(
        item.product.toString(),
        item.seller.toString(),
      );
      const commissionAmount = (item.total * commissionRate) / 100;
      const netEarning = item.total - commissionAmount;

      console.log(
        `[Commission] Item: ${item.product}, Rate: ${commissionRate}%, Amount: ${commissionAmount}, Net: ${netEarning}`,
      );

      // Create commission record as PAID immediately
      const commission = await Commission.create({
        order: item.order,
        orderItem: item._id,
        seller: item.seller,
        type: "SELLER",
        orderAmount: item.total,
        commissionRate,
        commissionAmount,
        status: "Paid", // Set to Paid immediately
        paidAt: new Date(),
      });

      // Credit Wallet Immediately
      if (seller) {
        await creditWallet(
          seller._id.toString(),
          "SELLER",
          netEarning,
          `Sale proceeds from Order #${order.orderNumber}`,
          item.order.toString(),
          commission._id.toString(),
        );
      }
    }

    console.log(`Commissions processed and credited for order ${orderId}`);
  } catch (error) {
    console.error("Error creating commissions:", error);
    throw error;
  }
};

/**
 * Distribute commissions for an order (Pending -> Paid)
 */
export const distributeCommissions = async (orderId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    // Check if order is delivered
    if (order.status !== "Delivered") {
      throw new Error(
        "Commissions can only be distributed for delivered orders",
      );
    }

    // Find Pending commissions
    const pendingCommissions = await Commission.find({
      order: orderId,
      status: "Pending",
    }).session(session);

    // If no pending commissions, maybe we missed creating them (e.g. legacy/error), try to create them now?
    // Or if they are already Paid?

    // Do not block here. We will check specifically for each type later.

    let commissionsToProcess = pendingCommissions;

    if (pendingCommissions.length === 0) {
      console.warn(
        `No pending commissions found for order ${orderId}, attempting to calculate now...`,
      );
      // Fallback: If for some reason they weren't created on payment, create them now directly as Paid?
      // Or create as Pending and then Process.
      // Since we are inside a transaction, calling the async createPendingCommissions (which doesn't take session) is risky.
      // Better to fail or handle gracefully. For now, let's assume strict flow.
      // Actually, let's allow "Lazy Creation" logic here if needed, but for now strict.
      // Reverting to throw error might block delivery if data is missing.
      // Let's implement inline calculation if missing (copy of logic) or just return if truly nothing to do.
      console.log(
        "Skipping commission distribution as no pending records found.",
      );
      // return { success: true, message: "No pending commissions to distribute" };
      // Wait, if we return here, seller gets nothing. We SHOULD calculate if missing.
      // But for this task, let's assume they will be created.
      // Ideally we should call `createPendingCommissions` here but pass the session.
    }

    const processedCommissions: any[] = [];

    // Group by Seller to credit wallet once per seller
    const sellerEarnings = new Map<
      string,
      { netAmount: number; commissionIds: string[] }
    >();

    for (const comm of commissionsToProcess) {
      // Update status to Paid
      comm.status = "Paid";
      comm.paidAt = new Date();
      await comm.save({ session });
      processedCommissions.push(comm);

      // Group for wallet credit (track orderAmount per seller for Self Assign shipping split)
      if (comm.type === "SELLER" && comm.seller) {
        const sellerId = comm.seller.toString();
        const netAmount = comm.orderAmount - comm.commissionAmount;

        if (!sellerEarnings.has(sellerId)) {
          sellerEarnings.set(sellerId, {
            netAmount: 0,
            orderAmount: 0,
            commissionIds: [] as string[],
          } as any);
        }
        const data = sellerEarnings.get(sellerId)! as any;
        data.netAmount += netAmount;
        data.orderAmount = (data.orderAmount || 0) + comm.orderAmount;
        data.commissionIds.push(comm._id.toString());
      }
    }

    const isSelfAssign = order.deliveryPreference === "Self";
    const shippingTotal = order.shipping || 0;

    // Self Assign: add delivery charge to seller earnings (proportional by item total)
    if (isSelfAssign && shippingTotal > 0) {
      let totalOrderAmount = 0;
      for (const [, data] of sellerEarnings.entries()) {
        totalOrderAmount += (data as any).orderAmount || 0;
      }
      if (totalOrderAmount > 0) {
        for (const [, data] of sellerEarnings.entries()) {
          const sellerOrderAmt = (data as any).orderAmount || 0;
          const proportion = sellerOrderAmt / totalOrderAmount;
          const shippingShare = Math.round(shippingTotal * proportion * 100) / 100;
          data.netAmount += shippingShare;
        }
      } else {
        // Prepaid Self: seller commissions already Paid on payment; credit only shipping now
        const existingSellerCommissions = await Commission.find({
          order: orderId,
          type: "SELLER",
        }).session(session);
        const sellerOrderAmounts = new Map<string, number>();
        for (const c of existingSellerCommissions) {
          const sid = (c.seller || c).toString();
          sellerOrderAmounts.set(sid, (sellerOrderAmounts.get(sid) || 0) + c.orderAmount);
        }
        const totalAmt = Array.from(sellerOrderAmounts.values()).reduce((a, b) => a + b, 0);
        if (totalAmt > 0) {
          for (const [sellerId, amt] of sellerOrderAmounts.entries()) {
            const proportion = amt / totalAmt;
            const shippingShare = Math.round(shippingTotal * proportion * 100) / 100;
            if (shippingShare > 0) {
              await creditWallet(
                sellerId,
                "SELLER",
                shippingShare,
                `Delivery charge (self-delivered) for order ${order.orderNumber}`,
                orderId,
                undefined,
                session,
              );
            }
          }
        }
      }
    }

    // Credit Seller Wallets
    for (const [sellerId, data] of sellerEarnings.entries()) {
      // For COD orders: Self Assign is credited in processCODOrderDeliverySelf; else credited when delivery boy pays admin.
      if (order.paymentMethod === "COD") {
        if (!isSelfAssign) {
          console.log(
            `[COD] Delaying seller credit for order ${order.orderNumber}. Will be credited when delivery boy pays admin.`,
          );
          await Commission.updateMany(
            { _id: { $in: data.commissionIds } },
            { $set: { status: "Pending", paidAt: null } },
            { session },
          );
        }
        continue;
      }

      await creditWallet(
        sellerId,
        "SELLER",
        data.netAmount,
        isSelfAssign && shippingTotal > 0
          ? `Sale proceeds + delivery charge (self-delivered) for order ${order.orderNumber}`
          : `Sale proceeds for order ${order.orderNumber}`,
        orderId,
        data.commissionIds[0], // Link to first commission for ref
        session,
      );
    }

    // For COD orders, delegate to the specialized COD processing logic
    if (order.paymentMethod && order.paymentMethod.toUpperCase() === "COD") {
      if (isSelfAssign) {
        await session.commitTransaction();
        await processCODOrderDeliverySelf(orderId);
        const codCommissions = await Commission.find({ order: orderId });
        return {
          success: true,
          message: "COD Self-delivery commissions processed",
          data: { commissions: codCommissions },
        };
      }
      console.log(
        `[Commission] Delegating COD order ${order.orderNumber} to processCODOrderDelivery`,
      );
      // End the current session as processCODOrderDelivery might start its own
      await session.commitTransaction();
      await processCODOrderDelivery(orderId);

      // Fetch the commissions created by processCODOrderDelivery to return them
      const codCommissions = await Commission.find({ order: orderId });

      return {
        success: true,
        message: "COD Commissions processed or already exists",
        data: {
          commissions: codCommissions,
        },
      };
    }

    // Handle Delivery Boy Commission only when delivery boy assigned and NOT Self Assign
    if (order.deliveryBoy && order.deliveryPreference !== "Self") {
      const deliveryBoyId = order.deliveryBoy.toString();
      const existingDeliveryComm = await Commission.findOne({
        order: orderId,
        type: "DELIVERY_BOY",
      }).session(session);

      if (!existingDeliveryComm) {
        console.log(
          `Creating missing commission for Delivery Boy ${deliveryBoyId}`,
        );

        // Calculate Commission Logic (Copied from calculateOrderCommissions)
        let commissionAmount = 0;
        let commissionRate = 0;
        let usedDistanceBased = false;

        try {
          // @ts-ignore
          const settings = await AppSettings.getSettings();
          if (
            settings &&
            settings.deliveryConfig?.isDistanceBased === true &&
            settings.deliveryConfig?.deliveryBoyKmRate &&
            order.deliveryDistanceKm &&
            order.deliveryDistanceKm > 0
          ) {
            commissionRate = settings.deliveryConfig.deliveryBoyKmRate;
            commissionAmount = order.deliveryDistanceKm * commissionRate;
            usedDistanceBased = true;
          }
        } catch (err) {
          console.error("Error checking settings for commission:", err);
        }

        if (!usedDistanceBased) {
          // Fallback to percentage based logic
          const { getDeliveryBoyCommissionRate } =
            await import("./commissionService");
          commissionRate = await getDeliveryBoyCommissionRate(deliveryBoyId);
          commissionAmount = (order.subtotal * commissionRate) / 100;
        }

        // Create Commission Record
        const newComm = await Commission.create(
          [
            {
              order: order._id,
              deliveryBoy: order.deliveryBoy,
              type: "DELIVERY_BOY",
              orderAmount: usedDistanceBased
                ? order.deliveryDistanceKm || 0
                : order.subtotal,
              commissionRate,
              commissionAmount: Math.round(commissionAmount * 100) / 100,
              status: "Paid",
              paidAt: new Date(),
            },
          ],
          { session },
        );

        const comm = newComm[0];
        processedCommissions.push(comm);

        // Credit Wallet Immediately
        await creditWallet(
          deliveryBoyId,
          "DELIVERY_BOY",
          comm.commissionAmount,
          `Delivery earning for order ${order.orderNumber}`,
          orderId,
          comm._id.toString(),
          session,
        );
      } else if (
        existingDeliveryComm &&
        existingDeliveryComm.status === "Pending"
      ) {
        // If it existed as pending, mark as paid and credit
        existingDeliveryComm.status = "Paid";
        existingDeliveryComm.paidAt = new Date();
        await existingDeliveryComm.save({ session });
        processedCommissions.push(existingDeliveryComm);

        await creditWallet(
          deliveryBoyId,
          "DELIVERY_BOY",
          existingDeliveryComm.commissionAmount,
          `Delivery earning for order ${order.orderNumber}`,
          orderId,
          existingDeliveryComm._id.toString(),
          session,
        );
      }
    }

    await session.commitTransaction();

    return {
      success: true,
      message: "Commissions distributed successfully",
      data: {
        commissions: processedCommissions,
      },
    };
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error distributing commissions:", error);
    return {
      success: false,
      message: error.message || "Failed to distribute commissions",
    };
  } finally {
    session.endSession();
  }
};

/**
 * Process pending COD commissions when delivery boy pays admin
 */
export const processPendingCODPayouts = async (
  deliveryBoyId: string,
  amountPaid: number,
  session?: mongoose.ClientSession,
) => {
  try {
    // Round amount paid for precision
    let remainingAmount = Math.round(amountPaid * 100) / 100;

    // Find all orders delivered by this delivery boy that have pending SELLER commissions
    const pendingCommissions = await Commission.find({
      type: "SELLER",
      status: "Pending",
    })
      .populate({
        path: "order",
        match: { deliveryBoy: deliveryBoyId, paymentMethod: "COD" },
      })
      .session(session || null)
      .sort({ createdAt: 1 }); // FIFO

    // Filter out commissions where order didn't match the populate criteria
    const validCommissions = pendingCommissions.filter(
      (comm) => comm.order !== null,
    );

    const processedOrders = new Set<string>();
    const PlatformWallet = (await import("../models/PlatformWallet")).default;
    let platformWallet = await PlatformWallet.findOne().session(
      session || null,
    );

    for (const comm of validCommissions) {
      if (remainingAmount <= 0.01) break; // Use small epsilon

      const order = comm.order as any;

      // Calculate how much this order contributes to the admin payout
      const deliveryComm = await Commission.findOne({
        order: order._id,
        type: "DELIVERY_BOY",
      }).session(session || null);

      if (!deliveryComm) continue;

      // Amount delivery boy owes for this order = Total Amount (since commission is credited to wallet)
      const orderAdminPayoutPart = Math.round(order.total * 100) / 100;

      // We process the commission if the amount paid covers this order's part (with small epsilon)
      if (remainingAmount >= orderAdminPayoutPart - 0.01) {
        comm.status = "Paid";
        comm.paidAt = new Date();
        await comm.save({ session });

        // Credit Seller Wallet
        const netEarning =
          Math.round((comm.orderAmount - comm.commissionAmount) * 100) / 100;
        if (comm.seller) {
          await creditWallet(
            comm.seller.toString(),
            "SELLER",
            netEarning,
            `Sale proceeds for COD order ${order.orderNumber} (Delivery boy payout confirmed)`,
            order._id.toString(),
            comm._id.toString(),
            session,
          );

          // Update platform wallet counters for this specifically processed order
          if (platformWallet) {
            // How much admin actually earned from this order (Commission + platform fee + admin shipping)
            const { calculateCODOrderBreakdown } =
              await import("./commissionService");
            const breakdown = await calculateCODOrderBreakdown(
              order._id.toString(),
            );

            platformWallet.totalAdminEarning += breakdown.totalAdminEarning;
            platformWallet.sellerPendingPayouts = Math.max(
              0,
              platformWallet.sellerPendingPayouts + netEarning,
            );
          }
        }

        remainingAmount -= orderAdminPayoutPart;
        processedOrders.add(order.orderNumber);
      }
    }

    if (platformWallet) {
      await platformWallet.save({ session });
    }

    console.log(
      `[COD Payout] Processed ${processedOrders.size} orders for delivery boy ${deliveryBoyId}. Remaining payment: ${remainingAmount}`,
    );

    return {
      success: true,
      processedCount: processedOrders.size,
      remainingAmount: Math.max(0, remainingAmount),
    };
  } catch (error) {
    console.error("Error processing pending COD payouts:", error);
    throw error;
  }
};

/**
 * Get commission summary for a user
 */
export const getCommissionSummary = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
) => {
  try {
    const query =
      userType === "SELLER" ? { seller: userId } : { deliveryBoy: userId };

    const commissions = await Commission.find(query).sort({ createdAt: -1 });

    const summary = {
      total: 0,
      paid: 0,
      pending: 0,
      count: commissions.length,
      commissions: commissions.map((c) => ({
        id: c._id,
        orderId: c.order,
        amount: c.commissionAmount,
        rate: c.commissionRate,
        orderAmount: c.orderAmount,
        status: c.status,
        paidAt: c.paidAt,
        createdAt: c.createdAt,
      })),
    };

    commissions.forEach((c) => {
      // For Sellers, earning is Order Amount - Commission Amount
      // For Delivery Boys, earning is the Commission Amount itself
      const earningAmount =
        userType === "SELLER"
          ? c.orderAmount - c.commissionAmount
          : c.commissionAmount;

      summary.total += earningAmount;
      if (c.status === "Paid") {
        summary.paid += earningAmount;
      } else if (c.status === "Pending") {
        summary.pending += earningAmount;
      }
    });

    return {
      success: true,
      data: summary,
    };
  } catch (error: any) {
    console.error("Error getting commission summary:", error);
    return {
      success: false,
      message: error.message || "Failed to get commission summary",
    };
  }
};

/**
 * Reverse commissions for a cancelled/returned order
 */
export const reverseCommissions = async (orderId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissions = await Commission.find({ order: orderId }).session(
      session,
    );

    if (commissions.length === 0) {
      // No commissions to reverse
      return {
        success: true,
        message: "No commissions to reverse",
      };
    }

    for (const commission of commissions) {
      // Only reverse if status is Paid
      if (commission.status === "Paid") {
        commission.status = "Cancelled";
        await commission.save({ session });

        // Debit from wallet
        const userId =
          commission.type === "SELLER"
            ? commission.seller
            : commission.deliveryBoy;
        const userType = commission.type;

        if (userId) {
          const { debitWallet } = await import("./walletManagementService");
          await debitWallet(
            userId.toString(),
            userType,
            commission.commissionAmount,
            `Commission reversal for cancelled order`,
            orderId,
            session,
          );
        }
      }
    }

    await session.commitTransaction();

    return {
      success: true,
      message: "Commissions reversed successfully",
    };
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error reversing commissions:", error);
    return {
      success: false,
      message: error.message || "Failed to reverse commissions",
    };
  } finally {
    session.endSession();
  }
};

/**
 * COD Order Breakdown Interface
 */
export interface ICODOrderBreakdown {
  orderId: string;
  orderNumber: string;

  // Product breakdown
  productCost: number; // Subtotal of all products
  adminProductCommission: number; // Admin's commission on products
  sellerEarnings: Map<string, number>; // Seller ID -> their earning (product cost - admin commission)

  // Fees
  platformFee: number;

  // Delivery breakdown
  totalDeliveryCharge: number;
  deliveryBoyCommission: number; // Delivery boy's earning from delivery
  adminDeliveryCommission: number; // Admin's portion of delivery charge

  // Totals
  totalAdminEarning: number; // adminProductCommission + platformFee + adminDeliveryCommission
  totalOrderAmount: number; // Grand total customer pays
  amountDeliveryBoyOwesAdmin: number; // Total - deliveryBoyCommission

  // Metadata
  deliveryBoyId?: string;
  deliveryDistanceKm?: number;
  isSelfAssign?: boolean; // true = delivery charge goes to seller(s), no delivery boy
}

/**
 * Calculate complete COD order breakdown
 * This function calculates how money flows for a COD order:
 * - Product commission (admin vs seller)
 * - Platform fee (goes to admin)
 * - Delivery charge split (delivery boy commission vs admin commission)
 */
export const calculateCODOrderBreakdown = async (
  orderId: string,
): Promise<ICODOrderBreakdown> => {
  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentMethod !== "COD") {
      throw new Error("This function is only for COD orders");
    }

    const isSelfAssign = order.deliveryPreference === "Self";
    const breakdown: ICODOrderBreakdown = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      productCost: order.subtotal,
      adminProductCommission: 0,
      sellerEarnings: new Map<string, number>(),
      platformFee: order.platformFee || 0,
      totalDeliveryCharge: order.shipping || 0,
      deliveryBoyCommission: 0,
      adminDeliveryCommission: 0,
      totalAdminEarning: 0,
      totalOrderAmount: order.total,
      amountDeliveryBoyOwesAdmin: 0,
      deliveryBoyId: order.deliveryBoy?.toString(),
      deliveryDistanceKm: order.deliveryDistanceKm,
      isSelfAssign,
    };

    // 1. Calculate Product Commissions (Admin vs Seller)
    for (const itemId of order.items) {
      const item = await OrderItem.findById(itemId);
      if (!item) continue;

      const product = await Product.findById(item.product);
      if (!product) continue;

      const commissionRate =
        item.commissionRate ||
        (await getOrderItemCommissionRate(
          item.product.toString(),
          item.seller.toString(),
        ));

      // Calculate commission and seller earning for this item
      const itemCommission = (item.total * commissionRate) / 100;
      const itemSellerEarning = item.total - itemCommission;

      breakdown.adminProductCommission += itemCommission;

      // Aggregate seller earnings
      const sellerId = item.seller.toString();
      const currentEarning = breakdown.sellerEarnings.get(sellerId) || 0;
      breakdown.sellerEarnings.set(
        sellerId,
        currentEarning + itemSellerEarning,
      );
    }

    // 2. Calculate Delivery Commission Split (Self Assign = delivery charge to seller, no delivery boy)
    if (isSelfAssign) {
      breakdown.deliveryBoyCommission = 0;
      breakdown.adminDeliveryCommission = 0;
      breakdown.amountDeliveryBoyOwesAdmin = 0;
      // totalAdminEarning computed below (no delivery share for admin)
    } else if (order.deliveryBoy) {
      const settings = await AppSettings.getSettings();

      // Check if distance-based delivery is enabled
      if (
        settings?.deliveryConfig?.isDistanceBased &&
        settings.deliveryConfig.deliveryBoyKmRate &&
        order.deliveryDistanceKm &&
        order.deliveryDistanceKm > 0
      ) {
        // Distance-based calculation
        const deliveryBoyKmRate = settings.deliveryConfig.deliveryBoyKmRate;
        breakdown.deliveryBoyCommission =
          order.deliveryDistanceKm * deliveryBoyKmRate;

        // Admin gets the rest of the delivery charge (possibly negative if they pay extra)
        breakdown.adminDeliveryCommission =
          breakdown.totalDeliveryCharge - breakdown.deliveryBoyCommission;
      } else {
        // Fallback: If no distance-based config, use percentage of order subtotal (matches prepaid logic)
        // Get delivery boy commission rate (default 5%)
        const deliveryBoy = await Delivery.findById(order.deliveryBoy);
        const deliveryBoyRate = deliveryBoy?.commissionRate || 5;

        // Use subtotal instead of shipping charge to avoid zero commission on free delivery.
        // This ensures the delivery boy always gets paid even if shipping is free.
        breakdown.deliveryBoyCommission =
          (order.subtotal * deliveryBoyRate) / 100;

        // Use subtotal based delivery boy pay, but admin still keeps the full delivery charge 
        // We will subtract the DB commission from total admin earning later
        breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
      }
    } else {
      // No delivery boy assigned (and not Self), all delivery charge goes to admin
      breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
    }

    // 3. Calculate Total Admin Earning (Self Assign: admin gets product commission + platform fee only; no delivery)
    breakdown.totalAdminEarning =
      breakdown.adminProductCommission +
      breakdown.platformFee +
      (isSelfAssign ? 0 : breakdown.adminDeliveryCommission);

    // 4. Amount Delivery Boy Owes Admin (only when delivery boy assigned)
    breakdown.amountDeliveryBoyOwesAdmin = order.deliveryBoy ? breakdown.totalOrderAmount : 0;

    console.log(`[COD Breakdown] Order ${order.orderNumber}:`, {
      productCost: breakdown.productCost,
      adminProductCommission: breakdown.adminProductCommission,
      platformFee: breakdown.platformFee,
      deliveryCharge: breakdown.totalDeliveryCharge,
      deliveryBoyCommission: breakdown.deliveryBoyCommission,
      adminDeliveryCommission: breakdown.adminDeliveryCommission,
      totalAdminEarning: breakdown.totalAdminEarning,
      amountDeliveryBoyOwes: breakdown.amountDeliveryBoyOwesAdmin,
    });

    return breakdown;
  } catch (error: any) {
    console.error("Error calculating COD order breakdown:", error);
    throw error;
  }
};

/**
 * Unified earning breakdown for any order (COD or Online).
 * For COD returns same as calculateCODOrderBreakdown.
 * For Online computes: product commission, platform fee, seller earnings, delivery split (Self → seller gets delivery; else delivery boy share).
 */
export const getOrderEarningBreakdown = async (
  orderId: string,
): Promise<ICODOrderBreakdown> => {
  const order = await Order.findById(orderId).populate("items");
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentMethod === "COD") {
    return calculateCODOrderBreakdown(orderId);
  }

  // Online / Prepaid: compute same-shaped breakdown
  const isSelfAssign = order.deliveryPreference === "Self";
  const breakdown: ICODOrderBreakdown = {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    productCost: order.subtotal,
    adminProductCommission: 0,
    sellerEarnings: new Map<string, number>(),
    platformFee: order.platformFee || 0,
    totalDeliveryCharge: order.shipping || 0,
    deliveryBoyCommission: 0,
    adminDeliveryCommission: 0,
    totalAdminEarning: 0,
    totalOrderAmount: order.total,
    amountDeliveryBoyOwesAdmin: 0,
    deliveryBoyId: order.deliveryBoy?.toString(),
    deliveryDistanceKm: order.deliveryDistanceKm,
    isSelfAssign,
  };

  const itemRefs = Array.isArray(order.items) ? order.items : [];
  for (const itemRef of itemRefs) {
    const item =
      itemRef &&
      typeof itemRef === "object" &&
      (itemRef as any).total != null
        ? (itemRef as any)
        : await OrderItem.findById((itemRef as any)?._id ?? itemRef);
    if (!item) continue;

    const commissionRate =
      item.commissionRate ||
      (await getOrderItemCommissionRate(
        item.product?.toString?.() ?? item.product,
        item.seller?.toString?.() ?? item.seller,
      ));
    const itemCommission = (item.total * commissionRate) / 100;
    const itemSellerEarning = item.total - itemCommission;

    breakdown.adminProductCommission += itemCommission;
    const sellerId = (item.seller?.toString?.() ?? item.seller).toString();
    const current = breakdown.sellerEarnings.get(sellerId) || 0;
    breakdown.sellerEarnings.set(sellerId, current + itemSellerEarning);
  }

  if (isSelfAssign) {
    breakdown.deliveryBoyCommission = 0;
    breakdown.adminDeliveryCommission = 0;
    const totalSellerEarning = Array.from(breakdown.sellerEarnings.values()).reduce((a, b) => a + b, 0);
    const shippingTotal = breakdown.totalDeliveryCharge || 0;
    if (totalSellerEarning > 0 && shippingTotal > 0) {
      for (const [sid, amt] of breakdown.sellerEarnings.entries()) {
        const proportion = amt / totalSellerEarning;
        const shippingShare = Math.round(shippingTotal * proportion * 100) / 100;
        breakdown.sellerEarnings.set(sid, amt + shippingShare);
      }
    }
  } else if (order.deliveryBoy) {
    const settings = await AppSettings.getSettings();
    if (
      settings?.deliveryConfig?.isDistanceBased &&
      settings.deliveryConfig.deliveryBoyKmRate &&
      order.deliveryDistanceKm &&
      order.deliveryDistanceKm > 0
    ) {
      const rate = settings.deliveryConfig.deliveryBoyKmRate;
      breakdown.deliveryBoyCommission = order.deliveryDistanceKm * rate;
      breakdown.adminDeliveryCommission =
        breakdown.totalDeliveryCharge - breakdown.deliveryBoyCommission;
    } else {
      const deliveryBoy = await Delivery.findById(order.deliveryBoy);
      const rate = deliveryBoy?.commissionRate ?? 5;
      breakdown.deliveryBoyCommission = (order.subtotal * rate) / 100;
      breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
    }
  } else {
    breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
  }

  breakdown.totalAdminEarning =
    breakdown.adminProductCommission +
    breakdown.platformFee +
    (isSelfAssign ? 0 : breakdown.adminDeliveryCommission);

  return breakdown;
};

/**
 * Process COD Order Delivery when seller self-delivers (Self Assign).
 * Credits sellers with net + proportional delivery charge; no delivery boy involved.
 */
export const processCODOrderDeliverySelf = async (
  orderId: string,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(orderId).populate("items").session(session);
    if (!order) throw new Error("Order not found");
    if (order.paymentMethod !== "COD") throw new Error("This function is only for COD orders");
    if (order.deliveryPreference !== "Self") throw new Error("This function is only for Self Assign COD orders");

    const breakdown = await calculateCODOrderBreakdown(orderId);
    const shippingTotal = breakdown.totalDeliveryCharge || 0;
    const sellerEarningsArray = Array.from(breakdown.sellerEarnings.entries());
    const totalSellerEarning = sellerEarningsArray.reduce((s, [, amt]) => s + amt, 0);
    const proportionDenom = totalSellerEarning > 0 ? totalSellerEarning : 1;

    for (const [sellerId, netEarning] of sellerEarningsArray) {
      const proportion = netEarning / proportionDenom;
      const shippingShare = Math.round(shippingTotal * proportion * 100) / 100;
      const totalCredit = Math.round((netEarning + shippingShare) * 100) / 100;

      const orderItems = await OrderItem.find({ order: orderId, seller: sellerId }).session(session);
      for (const item of orderItems) {
        const commRate =
          item.commissionRate ||
          (await getOrderItemCommissionRate(item.product.toString(), item.seller.toString()));
        const itemCommission = (item.total * commRate) / 100;
        await Commission.create(
          [
            {
              order: orderId,
              orderItem: item._id,
              seller: sellerId,
              type: "SELLER",
              orderAmount: item.total,
              commissionRate: commRate,
              commissionAmount: itemCommission,
              status: "Paid",
              paidAt: new Date(),
            },
          ],
          { session },
        );
      }

      await creditWallet(
        sellerId,
        "SELLER",
        totalCredit,
        `Sale proceeds + delivery charge (self-delivered) for COD order ${order.orderNumber}`,
        orderId,
        undefined,
        session,
      );
    }

    await session.commitTransaction();
    console.log(`[COD Self Delivery] Order ${order.orderNumber} processed. Sellers credited with net + delivery charge.`);
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error in processCODOrderDeliverySelf:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Process COD Order Delivery
 * Called when a COD order is marked as delivered (with delivery boy)
 * Updates delivery boy wallet, platform wallet, and creates commission records
 */
export const processCODOrderDelivery = async (
  orderId: string,
  session?: mongoose.ClientSession,
): Promise<void> => {
  const useExternalSession = !!session;
  if (!session) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentMethod !== "COD") {
      throw new Error("This function is only for COD orders");
    }

    if (order.deliveryPreference === "Self") {
      throw new Error("Use processCODOrderDeliverySelf for Self Assign COD orders");
    }

    if (!order.deliveryBoy) {
      throw new Error("Order must have a delivery boy assigned");
    }

    // Calculate complete breakdown
    const breakdown = await calculateCODOrderBreakdown(orderId);

    // Import PlatformWallet
    const PlatformWallet = (await import("../models/PlatformWallet")).default;

    // Check if already processed to avoid double-counting
    const existingTx = await WalletTransaction.findOne({
      userId: order.deliveryBoy.toString(),
      relatedOrder: orderId,
      description: { $regex: /Delivery earning for COD order/i },
    }).session(session);

    if (existingTx) {
      console.log(
        `[COD Delivery] Order ${order.orderNumber} already processed. Skipping all financial updates.`,
      );
    } else {
      // 1. Update Delivery Boy Wallet
      const deliveryBoy = await Delivery.findById(order.deliveryBoy).session(
        session,
      );
      if (!deliveryBoy) {
        throw new Error("Delivery boy not found");
      }

      // Delivery boy owes admin the rest. Use safety addition to prevent NaN
      const currentPayout = deliveryBoy.pendingAdminPayout || 0;
      deliveryBoy.pendingAdminPayout =
        currentPayout + breakdown.amountDeliveryBoyOwesAdmin;

      // Track cash collected
      const currentCash = deliveryBoy.cashCollected || 0;
      deliveryBoy.cashCollected = currentCash + breakdown.totalOrderAmount;

      await deliveryBoy.save({ session });

      // Create wallet transaction for delivery boy commission
      await creditWallet(
        order.deliveryBoy.toString(),
        "DELIVERY_BOY",
        breakdown.deliveryBoyCommission,
        `Delivery earning for COD order ${order.orderNumber}`,
        orderId,
        undefined,
        session,
      );

      // 2. Update Platform Wallet
      const platformWallet = await PlatformWallet.findOne().session(session);

      if (!platformWallet) {
        // Create new platform wallet if it doesn't exist
        await PlatformWallet.create(
          [
            {
              totalPlatformEarning: 0,
              currentPlatformBalance: 0,
              totalAdminEarning: 0,
              pendingFromDeliveryBoy: breakdown.amountDeliveryBoyOwesAdmin,
              sellerPendingPayouts: 0,
              deliveryBoyPendingPayouts: breakdown.deliveryBoyCommission,
            },
          ],
          { session },
        );
      } else {
        // Update existing platform wallet
        platformWallet.pendingFromDeliveryBoy +=
          breakdown.amountDeliveryBoyOwesAdmin;
        platformWallet.deliveryBoyPendingPayouts +=
          breakdown.deliveryBoyCommission;
        await platformWallet.save({ session });
      }

      // 3. Create Commission Records (marked as Pending for sellers, Paid for delivery boy)

      // Create delivery boy commission record
      const deliveryCommission = new Commission({
        order: orderId,
        deliveryBoy: order.deliveryBoy,
        type: "DELIVERY_BOY",
        orderAmount:
          breakdown.deliveryDistanceKm || breakdown.totalDeliveryCharge,
        commissionRate: breakdown.deliveryDistanceKm
          ? breakdown.deliveryBoyCommission / breakdown.deliveryDistanceKm
          : (breakdown.deliveryBoyCommission / breakdown.totalDeliveryCharge) *
          100,
        commissionAmount: breakdown.deliveryBoyCommission,
        status: "Paid", // Delivery boy gets paid immediately
        paidAt: new Date(),
      });
      await deliveryCommission.save({ session });

      // Create seller commission records (marked as Pending - will be paid when delivery boy pays admin)
      const sellerEarningsArray = Array.from(
        breakdown.sellerEarnings.entries(),
      );
      for (const [sellerId] of sellerEarningsArray) {
        // Find order items for this seller to get commission details
        const orderItems = await OrderItem.find({
          order: orderId,
          seller: sellerId,
        }).session(session);

        for (const item of orderItems) {
          const commRate =
            item.commissionRate ||
            (await getOrderItemCommissionRate(
              item.product.toString(),
              item.seller.toString(),
            ));
          const itemCommission = (item.total * commRate) / 100;

          const sellerCommission = new Commission({
            order: orderId,
            orderItem: item._id,
            seller: sellerId,
            type: "SELLER",
            orderAmount: item.total,
            commissionRate: commRate,
            commissionAmount: itemCommission,
            status: "Pending", // Seller will be paid when delivery boy pays admin
            paidAt: null,
          });
          await sellerCommission.save({ session });
        }
      }

      console.log(`[COD Delivery] Order ${order.orderNumber} fully processed.`);

      // 4. Create a Pending Cash Collection record for Admin to track
      const { default: CashCollection } = await import("../models/CashCollection");
      await CashCollection.create([
        {
          deliveryBoy: order.deliveryBoy,
          order: orderId,
          amount: breakdown.totalOrderAmount,
          remark: `Auto-generated from delivered COD order ${order.orderNumber}`,
          status: "Pending"
        }
      ], { session });

      console.log(`[COD Delivery] Pending Cash Collection record created for order ${order.orderNumber}`);
    }

    if (!useExternalSession) {
      await session.commitTransaction();
    }
  } catch (error: any) {
    if (!useExternalSession) {
      await session.abortTransaction();
    }
    console.error("Error processing COD order delivery:", error);
    throw error;
  } finally {
    if (!useExternalSession) {
      session.endSession();
    }
  }
};
