import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Return from "../models/Return";
import Customer from "../models/Customer";
import Refund from "../models/Refund";
import { processRefund } from "./paymentService";
import { debitWallet, creditWallet } from "./walletManagementService";

export interface IItemRefundCalculation {
  returnedItemTotal: number;
  returnedCommissionRate: number;
  returnedCommissionAmount: number;
  sellerNetReversal: number;
  customerRefundAmount: number;
}

/**
  * Calculate exact refund and reversal breakdown for a returned item/quantity.
  * Handles partial quantity returns (e.g., returning 1 unit out of 3).
  */
export const calculateItemRefundAmount = (
  orderItem: any,
  quantityToReturn: number
): IItemRefundCalculation => {
  const returnQty = Math.min(quantityToReturn, orderItem.quantity);
  const proportion = returnQty / orderItem.quantity;
  const returnedItemTotal = Math.round(orderItem.total * proportion * 100) / 100;

  // BUG FIX: Use ?? (nullish coalescing) not || (logical or).
  // With ||, commissionRate=0 would fall back to 10, charging sellers a 10% fee when they have 0% commission.
  const returnedCommissionRate = orderItem.commissionRate ?? 10;
  const returnedCommissionAmount = Math.round((returnedItemTotal * returnedCommissionRate) / 100 * 100) / 100;
  const sellerNetReversal = Math.round((returnedItemTotal - returnedCommissionAmount) * 100) / 100;

  return {
    returnedItemTotal,
    returnedCommissionRate,
    returnedCommissionAmount,
    sellerNetReversal,
    customerRefundAmount: returnedItemTotal,
  };
};

/**
  * 1. PRE-FULFILLMENT ORDER CANCELLATION REFUND (100% Full Customer Refund)
  * Idempotently refunds 100% of all amounts actually paid by customer (Wallet + Razorpay).
  * Delivery fee and platform fee are 100% refunded because order was cancelled before fulfillment.
  */
export const handleOnlineOrderCancellation = async (
  orderId: string,
  cancellationReason?: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      // Enforce cancellation timing: Delivered orders CANNOT be cancelled
      if (order.status === "Delivered") {
        throw new Error("Delivered orders cannot be cancelled via cancellation flow. Please use the Customer Return process.");
      }

      if (order.paymentStatus === "Refunded") {
        await session.commitTransaction();
        return { success: true, message: "Order is already marked Refunded (Idempotent)." };
      }

      let walletRefundExecuted = false;
      let onlineRefundExecuted = false;

      // 1. REFUND WALLET PORTION (100% of wallet amount actually used)
      if (order.walletAmountUsed && order.walletAmountUsed > 0 && order.customer) {
        const walletRes = await creditWallet(
          order.customer.toString(),
          "CUSTOMER",
          order.walletAmountUsed,
          `Order cancellation refund for #${order.orderNumber}`,
          order._id.toString(),
          undefined,
          session,
          `CANCEL_REFUND_WALLET_${order._id.toString()}`,
          "ORDER_CANCELLATION_REFUND"
        );
        if (!walletRes.success) {
          throw new Error(`Failed to refund wallet portion: ${walletRes.message}`);
        }
        walletRefundExecuted = true;
      }

      // 2. REFUND RAZORPAY ONLINE PORTION (100% of online amount actually paid)
      const onlineAmountToRefund = order.onlineAmountPaid || (order.paymentMethod === "Online" ? order.total : 0);
      let refundResultData: any = null;

      if (onlineAmountToRefund > 0) {
        const payment = await Payment.findOne({
          $or: [{ order: order._id }, { razorpayPaymentId: order.paymentId }]
        }).session(session);

        if (payment && payment.status !== "Refunded") {
          const refundResult = await processRefund(
            payment._id.toString(),
            onlineAmountToRefund,
            cancellationReason || "Order cancelled before delivery",
            session
          );

          if (!refundResult.success) {
            throw new Error(refundResult.message || "Failed to process Razorpay online refund");
          }

          payment.status = "Refunded";
          payment.refundAmount = onlineAmountToRefund;
          payment.refundedAt = new Date();
          payment.refundReason = cancellationReason || "Order cancelled before delivery";
          await payment.save({ session });
          refundResultData = refundResult.data;
          onlineRefundExecuted = true;
        }
      }

      // Mark order payment status refunded
      order.paymentStatus = "Refunded";
      order.status = "Cancelled";
      await order.save({ session });

      // Cancel all commission records for this order
      await Commission.updateMany(
        { order: order._id },
        { $set: { status: "Cancelled" } },
        { session }
      );

      await session.commitTransaction();

      return {
        success: true,
        message: "Order cancellation refund executed successfully (100% actual customer payment returned)",
        data: {
          orderId: order._id,
          walletRefunded: order.walletAmountUsed || 0,
          onlineRefunded: onlineAmountToRefund,
          onlineResult: refundResultData,
        },
      };
    } catch (error: any) {
      await session.abortTransaction();
      const isWriteConflict =
        error?.message?.includes('Write conflict') ||
        error?.message?.includes('WriteConflict') ||
        error?.code === 112 ||
        error?.codeName === 'WriteConflict' ||
        (typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError'));

      if (isWriteConflict && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 150 * attempt));
        continue;
      }

      console.error("Error in handleOnlineOrderCancellation:", error);
      return {
        success: false,
        message: error.message || "Failed to handle order cancellation refund",
      };
    } finally {
      session.endSession();
    }
  }

  return { success: false, message: "Failed to process cancellation refund due to transaction write conflicts" };
};

/**
   * 2. CUSTOMER RETURN FINANCIAL SETTLEMENT & REFUND (Post-delivery)
   * Reverses seller earnings, cancels item commissions, and refunds the customer.
   * Product Price Only is refundable (delivery and platform fees are non-refundable).
   * Uses deterministic refund allocation: consumes wallet-funded portion first, then Razorpay.
   */
export const executeReturnRefundAndReversal = async (
  returnId: string,
  processedByUserId?: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const returnReq = await Return.findById(returnId).session(session);
      if (!returnReq) {
        throw new Error("Return request not found");
      }

      // Idempotency Protection: If financial settlement was already completed, skip
      if (returnReq.financialSettlementStatus === "Completed") {
        await session.commitTransaction();
        return {
          success: true,
          message: "Return financial settlement already completed (Idempotent).",
          data: returnReq,
        };
      }

      const order = await Order.findById(returnReq.order).session(session);
      if (!order) {
        throw new Error("Associated order not found");
      }

      const orderItem = await OrderItem.findById(returnReq.orderItem).session(session);
      if (!orderItem) {
        throw new Error("Associated order item not found");
      }

      // Calculate exact refund & reversal values (Product Price Only)
      const breakdown = calculateItemRefundAmount(orderItem, returnReq.quantity);
      const productRefundTotal = breakdown.customerRefundAmount;

      // 1. REVERSE SELLER EARNING (If order was delivered & settled)
      const existingCommission = await Commission.findOne({
        order: order._id,
        orderItem: orderItem._id,
        type: "SELLER",
      }).session(session);

      let sellerReversed = false;
      const sellerId = orderItem.seller.toString();

      if (existingCommission && existingCommission.status === "OnHold") {
        // Debit exact net seller earning from Seller On-Hold Balance
        const { default: Seller } = await import("../models/Seller");
        await Seller.findByIdAndUpdate(
          sellerId,
          { $inc: { onHoldBalance: -breakdown.sellerNetReversal } },
          { session }
        );

        existingCommission.status = "Cancelled";
        await existingCommission.save({ session });
        sellerReversed = true;
      } else if (existingCommission && existingCommission.status === "Paid") {
        // Debit exact net seller earning from Seller Available Wallet
        await debitWallet(
          sellerId,
          "SELLER",
          breakdown.sellerNetReversal,
          `Return reversal for order #${order.orderNumber} (${returnReq.quantity}x ${orderItem.productName})`,
          order._id.toString(),
          session
        );

        existingCommission.status = "Cancelled";
        await existingCommission.save({ session });
        sellerReversed = true;
      } else if (existingCommission && existingCommission.status === "Pending") {
        existingCommission.status = "Cancelled";
        await existingCommission.save({ session });
      }

      // 2. DETERMINISTIC CUSTOMER REFUND ALLOCATION
      // Allocate productRefundTotal between Wallet and Razorpay/COD
      const walletAllocationMax = order.walletAmountUsed || 0;
      const walletRefundPortion = Math.min(walletAllocationMax, productRefundTotal);
      const remainingProductRefund = productRefundTotal - walletRefundPortion;

      let refundDetails: any = { walletRefundPortion, remainingProductRefund };
      let matchedPayment: any = null;

      // Credit wallet portion if any
      if (walletRefundPortion > 0 && order.customer) {
        const walletCreditRes = await creditWallet(
          order.customer.toString(),
          "CUSTOMER",
          walletRefundPortion,
          `Return refund for order #${order.orderNumber} (${returnReq.quantity}x ${orderItem.productName})`,
          order._id.toString(),
          undefined,
          session,
          `RETURN_REFUND_WALLET_${returnReq._id.toString()}`,
          "COD_RETURN_REFUND",
          returnReq._id.toString()
        );
        if (!walletCreditRes.success) {
          throw new Error(`Failed to credit wallet portion of return refund: ${walletCreditRes.message}`);
        }
      }

      // Credit remaining product refund
      if (remainingProductRefund > 0) {
        if (order.onlineAmountPaid && order.onlineAmountPaid > 0) {
          matchedPayment = await Payment.findOne({
            $or: [{ order: order._id }, { razorpayPaymentId: order.paymentId }]
          }).session(session);

          if (matchedPayment && matchedPayment.razorpayPaymentId) {
            const razorpayRefundAmount = Math.min(order.onlineAmountPaid, remainingProductRefund);
            const refundResult = await processRefund(
              matchedPayment._id.toString(),
              razorpayRefundAmount,
              `Return refund for order #${order.orderNumber}`,
              session
            );

            if (refundResult.success) {
              refundDetails.razorpayRefundAmount = razorpayRefundAmount;
              refundDetails.refundResult = refundResult.data;
              matchedPayment.refundAmount = (matchedPayment.refundAmount || 0) + razorpayRefundAmount;
              if (matchedPayment.refundAmount >= order.total) {
                matchedPayment.status = "Refunded";
                order.paymentStatus = "Refunded";
              }
              matchedPayment.refundedAt = new Date();
              matchedPayment.refundReason = `Return refund: ${returnReq.reason}`;
              await matchedPayment.save({ session });
              await order.save({ session });
            } else {
              console.warn(`[RETURN REFUND] Razorpay refund note: ${refundResult.message}`);
            }
          }
        }

        // ALWAYS credit Customer Wallet for the return refund so the customer receives the in-app wallet balance
        const targetCustomerId = (order.customer || returnReq.customer)?.toString();
        if (targetCustomerId) {
          console.log(`[RETURN REFUND] Return ID: ${returnReq._id}, Customer ID: ${targetCustomerId}, Order ID: ${order._id}, Refund Amount: ₹${remainingProductRefund}`);
          console.log(`[RETURN REFUND] Wallet Credit Started`);
          const custWalletRes = await creditWallet(
            targetCustomerId,
            "CUSTOMER",
            remainingProductRefund,
            `Return refund for order #${order.orderNumber}`,
            order._id.toString(),
            undefined,
            session,
            `RETURN_REFUND_WALLET_${returnReq._id.toString()}`,
            "COD_RETURN_REFUND",
            returnReq._id.toString()
          );
          if (!custWalletRes.success) {
            console.error(`[RETURN REFUND ERROR] Customer wallet credit failed: ${custWalletRes.message}`);
            throw new Error(`Failed to credit customer wallet return refund: ${custWalletRes.message}`);
          }
          console.log(`[RETURN REFUND] Wallet Credit Successful. Transaction ID: ${custWalletRes.data?.transactionId}`);
          refundDetails.codWalletRefundAmount = remainingProductRefund;
        }
      }


      // 3. RECORD REFUND & COMPLETE RETURN SETTLEMENT
      const refundData: any = {
        order: order._id,
        customer: returnReq.customer,
        amount: productRefundTotal,
        reason: returnReq.reason,
        status: "Completed",
        paymentMethod: order.paymentMethod,
      };

      if (matchedPayment) {
        refundData.payment = matchedPayment._id;
      }

      const refundDoc = new Refund(refundData);
      await refundDoc.save({ session });

      returnReq.status = "Completed";
      returnReq.financialSettlementStatus = "Completed";
      returnReq.refundAmount = productRefundTotal;
      returnReq.refundId = refundDoc._id as any;
      if (processedByUserId) {
        returnReq.processedBy = new mongoose.Types.ObjectId(processedByUserId);
      }
      returnReq.processedAt = new Date();
      await returnReq.save({ session });

      orderItem.status = "Returned";
      await orderItem.save({ session });

      // Check if all items in order are returned
      const remainingActiveItems = await OrderItem.countDocuments({
        order: order._id,
        status: { $ne: "Returned" }
      }).session(session);

      if (remainingActiveItems === 0) {
        order.status = "Returned";
        await order.save({ session });
      }

      await session.commitTransaction();

      return {
        success: true,
        message: "Return financial settlement and refund executed successfully",
        data: {
          returnId: returnReq._id,
          breakdown,
          sellerReversed,
          refundDetails,
        },
      };
    } catch (error: any) {
      await session.abortTransaction();
      const isWriteConflict =
        error?.message?.includes('Write conflict') ||
        error?.message?.includes('WriteConflict') ||
        error?.code === 112 ||
        error?.codeName === 'WriteConflict' ||
        (typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError'));
      
      if (isWriteConflict && attempt < maxRetries) {
        console.warn(`[Return Settlement] Write conflict on attempt ${attempt}/${maxRetries}. Retrying in ${200 * attempt}ms...`);
        await new Promise(r => setTimeout(r, 200 * attempt));
        continue;
      }

      console.error("Error executing return refund & reversal:", error);
      return {
        success: false,
        message: error.message || "Failed to execute return refund & reversal",
      };
    } finally {
      session.endSession();
    }
  }

  return { success: false, message: "Failed to execute return refund due to transaction write conflicts" };
};
