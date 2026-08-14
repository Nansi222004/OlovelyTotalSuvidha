import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  getWalletTransactions,
  createWithdrawalRequest,
  getWithdrawalRequests,
} from "../../../services/walletManagementService";
import {
  getCommissionSummary,
  processPendingCODPayouts,
} from "../../../services/commissionService";
import Delivery from "../../../models/Delivery";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
} from "../../../services/paymentService";
import WalletTransaction from "../../../models/WalletTransaction";

/**
 * Get delivery boy wallet balance and pending admin payout
 */
export const getBalance = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;
    const deliveryBoy = await Delivery.findById(deliveryBoyId).select(
      "balance pendingAdminPayout",
    );

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: deliveryBoy.balance,
        pendingAdminPayout: deliveryBoy.pendingAdminPayout || 0,
      },
    });
  } catch (error: any) {
    console.error("Error getting wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get wallet balance",
    });
  }
};

/**
 * Create Razorpay order for paying admin
 */
export const createAdminPayoutOrder = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout amount",
      });
    }

    const deliveryBoy = await Delivery.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    if ((deliveryBoy.pendingAdminPayout || 0) < amount) {
      return res.status(400).json({
        success: false,
        message: "Payout amount exceeds pending amount",
      });
    }

    const receipt = `PAYOUT-ADMIN-${Date.now()}`;
    const result = await createRazorpayOrder(receipt, amount);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error creating admin payout order:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create payout order",
    });
  }
};

/**
 * Verify admin payout payment
 */
export const verifyAdminPayout = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deliveryBoyId = req.user!.userId;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    // Ensure amount is a number and rounded
    const amount = Math.round(Number(req.body.amount) * 100) / 100;

    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Update delivery boy pendingAdminPayout
    const deliveryBoy = await Delivery.findById(deliveryBoyId).session(session);
    if (!deliveryBoy) {
      throw new Error("Delivery boy not found");
    }

    // Round pending payout for comparison
    const currentPending = Math.round((deliveryBoy.pendingAdminPayout || 0) * 100) / 100;

    // Validate amount doesn't significantly exceed pending (using a small epsilon)
    if (amount > currentPending + 0.01) {
      throw new Error(
        `Payment amount (₹${amount}) exceeds pending admin payout (₹${currentPending})`
      );
    }

    // Record transaction first
    const reference = `PAYOUT-${razorpayPaymentId}`;
    const transaction = new WalletTransaction({
      userId: deliveryBoyId,
      userType: "DELIVERY_BOY",
      amount: amount,
      type: "Debit",
      description: "Payout to Admin via Razorpay",
      status: "Completed",
      reference,
    });
    await transaction.save({ session });

    // Update Platform Wallet
    const PlatformWallet = (await import("../../../models/PlatformWallet")).default;
    let platformWallet = await PlatformWallet.findOne().session(session);

    if (!platformWallet) {
      const walletArray = await PlatformWallet.create([{
        totalPlatformEarning: 0,
        currentPlatformBalance: 0,
        totalAdminEarning: 0,
        pendingFromDeliveryBoy: 0,
        sellerPendingPayouts: 0,
        deliveryBoyPendingPayouts: 0,
      }], { session });
      platformWallet = walletArray[0];
    }

    // Update platform wallet with the payment
    platformWallet.totalPlatformEarning += amount; // Total money received
    platformWallet.currentPlatformBalance += amount; // Current balance increases
    platformWallet.pendingFromDeliveryBoy = Math.max(0, platformWallet.pendingFromDeliveryBoy - amount);

    await platformWallet.save({ session });

    // Distribute funds to sellers now that admin has received the money
    // This will handle admin commissioned portion correctly per order
    const payoutResult = await processPendingCODPayouts(deliveryBoyId, amount, session);

    // Update delivery boy after distributing (to be safe with intermediate states)
    deliveryBoy.pendingAdminPayout = Math.max(0, currentPending - amount);
    await deliveryBoy.save({ session });

    await session.commitTransaction();

    console.log(`[Pay to Admin] Delivery boy ${deliveryBoyId} paid ${amount}:`, {
      newPending: deliveryBoy.pendingAdminPayout,
      processedOrders: payoutResult.processedCount,
      platformBalance: platformWallet.currentPlatformBalance,
    });

    return res.status(200).json({
      success: true,
      message: "Payout successful",
      data: {
        pendingAdminPayout: deliveryBoy.pendingAdminPayout,
        amountPaid: amount,
        platformBalance: platformWallet.currentPlatformBalance,
      },
    });
  } catch (error: any) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error verifying admin payout:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payout",
    });
  } finally {
    session.endSession();
  }
};


/**
 * Get delivery boy wallet transactions
 */
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;
    const { page = 1, limit = 20 } = req.query;

    const result = await getWalletTransactions(
      deliveryBoyId,
      "DELIVERY_BOY",
      Number(page),
      Number(limit),
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error getting wallet transactions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get wallet transactions",
    });
  }
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount",
      });
    }

    if (!paymentMethod || !["Bank Transfer", "UPI"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const result = await createWithdrawalRequest(
      deliveryBoyId,
      "DELIVERY_BOY",
      amount,
      paymentMethod,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    console.error("Error requesting withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to request withdrawal",
    });
  }
};

/**
 * Get delivery boy withdrawal requests
 */
export const getWithdrawals = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;
    const { status } = req.query;

    const result = await getWithdrawalRequests(
      deliveryBoyId,
      "DELIVERY_BOY",
      status as string,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error getting withdrawal requests:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get withdrawal requests",
    });
  }
};

/**
 * Get delivery boy commission earnings
 */
export const getCommissions = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = req.user!.userId;

    const result = await getCommissionSummary(deliveryBoyId, "DELIVERY_BOY");

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error getting commission earnings:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get commission earnings",
    });
  }
};
