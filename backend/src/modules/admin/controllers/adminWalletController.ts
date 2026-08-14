import { Request, Response } from "express";
import mongoose from "mongoose";
import Commission from "../../../models/Commission";
import WalletTransaction from "../../../models/WalletTransaction";
import WithdrawRequest from "../../../models/WithdrawRequest";
import { asyncHandler } from "../../../utils/asyncHandler";
import {
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal,
} from "./adminWithdrawalController";
import Seller from "../../../models/Seller";
import Delivery from "../../../models/Delivery";
import Order from "../../../models/Order";

/**
 * Get Financial Dashboard Stats
 */
/**
 * Get Financial Dashboard Stats
 */
export const getFinancialDashboard = asyncHandler(
  async (_req: Request, res: Response) => {
    // Import PlatformWallet
    const PlatformWallet = (await import("../../../models/PlatformWallet")).default;

    // Get Platform Wallet data
    const platformWallet = await PlatformWallet.findOne();

    // 1. Calculate Real-time Seller Pending Payouts -> Sum of all Seller Balances
    const sellerBalanceResult = await Seller.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } },
    ]);
    const realTimeSellerPending = sellerBalanceResult.length > 0 ? sellerBalanceResult[0].total : 0;

    // 2. Calculate Real-time Delivery Boy Pending Payouts & Debt
    const deliveryBalanceResult = await Delivery.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
          totalPendingDebt: { $sum: "$pendingAdminPayout" },
        },
      },
    ]);
    const realTimeDeliveryPendingPayouts = deliveryBalanceResult.length > 0 ? deliveryBalanceResult[0].totalBalance : 0;
    const realTimePendingFromDeliveryBoy = deliveryBalanceResult.length > 0 ? deliveryBalanceResult[0].totalPendingDebt : 0;

    if (platformWallet) {
      // Use platform wallet for overall earnings but real-time aggregates for payouts
      return res.status(200).json({
        success: true,
        data: {
          // Platform Wallet Data (Earnings & Balance)
          totalPlatformEarning: platformWallet.totalPlatformEarning,
          currentPlatformBalance: platformWallet.currentPlatformBalance,
          totalAdminEarning: Math.round(platformWallet.totalAdminEarning * 100) / 100,

          // Real-time aggregates of balances (Liabilities)
          pendingFromDeliveryBoy: realTimePendingFromDeliveryBoy,
          sellerPendingPayouts: realTimeSellerPending,
          deliveryBoyPendingPayouts: realTimeDeliveryPendingPayouts,
          deliveryPendingPayouts: realTimeDeliveryPendingPayouts,

          // Legacy fields for backward compatibility
          totalGMV: platformWallet.totalPlatformEarning,
          totalAdminEarnings: Math.round(platformWallet.totalAdminEarning * 100) / 100,
          currentAccountBalance: platformWallet.currentPlatformBalance,
          pendingAmountFromDeliveryBoy: realTimePendingFromDeliveryBoy,

          // Additional stats
          pendingWithdrawalsCount: await WithdrawRequest.countDocuments({
            status: "Pending",
          }),
        },
      });
    }

    // Fallback: Calculate from scratch if platform wallet doesn't exist yet
    // (This handles the case before any COD orders have been processed)

    // 1. Total Platform Earnings (Net GMV)
    // Formula: Sum(Order.total) - Sum(Delivery Commissions)
    // This represents the total money that flows into the platform (Admin + Sellers)
    const totalOrderAmountResult = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" }, paymentStatus: "Paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalOrderAmount =
      totalOrderAmountResult.length > 0 ? totalOrderAmountResult[0].total : 0;

    // All delivery commissions (to be subtracted from gross GMV for net platform earnings)
    // For COD orders, the user requested not to reduce anything from platform earning and balance
    const allDeliveryCommResult = await Commission.aggregate([
      { $match: { type: "DELIVERY_BOY", status: { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderData",
        },
      },
      { $unwind: "$orderData" },
      { $match: { "orderData.paymentMethod": { $ne: "COD" } } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]);
    const allDeliveryCommissions =
      allDeliveryCommResult.length > 0 ? allDeliveryCommResult[0].total : 0;

    const totalGMV = totalOrderAmount - allDeliveryCommissions;

    // 2. Total Admin Earnings
    // Formula: SellerCommissions + OrderFees (Platform+Shipping) - DeliveryCommissions

    // A. Seller Commissions (The 10% part)
    const sellerCommResult = await Commission.aggregate([
      { $match: { type: "SELLER", status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]);
    const sellerCommissions =
      sellerCommResult.length > 0 ? sellerCommResult[0].total : 0;

    // B. Delivery Commissions (The part paid to delivery boy)
    // For COD orders, the user requested not to subtract delivery commissions from admin earnings
    const deliveryCommResult = await Commission.aggregate([
      { $match: { type: "DELIVERY_BOY", status: { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderData",
        },
      },
      { $unwind: "$orderData" },
      { $match: { "orderData.paymentMethod": { $ne: "COD" } } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]);
    const deliveryCommissions =
      deliveryCommResult.length > 0 ? deliveryCommResult[0].total : 0;

    // C. Order Fees (Platform Fee + Shipping Charge)
    const orderFeesResult = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" }, paymentStatus: "Paid" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $add: ["$platformFee", "$shipping"] } },
        },
      },
    ]);
    const orderFees = orderFeesResult.length > 0 ? orderFeesResult[0].total : 0;

    // Calculation: (SellerComm + PlatformFee + Shipping) - DeliveryComm
    // This effectively gives: SellerComm + PlatformFee + (Shipping - DeliveryComm) -> where (Shipping-DeliveryComm) is Base Charge
    const totalAdminEarnings =
      sellerCommissions + orderFees - deliveryCommissions;

    // Calculate Total Completed Withdrawals (Outflow)
    const withdrawalResult = await WithdrawRequest.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWithdrawals =
      withdrawalResult.length > 0 ? withdrawalResult[0].total : 0;

    // Current Platform Balance = Total Inflow (GMV) - Total Outflow (Withdrawals)
    const currentAccountBalance = totalGMV - totalWithdrawals;

    // 3. Reuse calculated Real-time Seller Pending Payouts
    const sellerPendingPayouts = realTimeSellerPending;

    // 4. Reuse calculated Real-time Delivery Boy Pending Payouts
    const deliveryPendingPayouts = realTimeDeliveryPendingPayouts;
    const pendingAmountFromDeliveryBoy = realTimePendingFromDeliveryBoy;

    return res.status(200).json({
      success: true,
      data: {
        totalGMV,
        totalAdminEarnings,
        totalWithdrawals,
        currentAccountBalance,
        sellerPendingPayouts,
        deliveryPendingPayouts,
        pendingAmountFromDeliveryBoy,
        // Legacy field just in case
        pendingWithdrawalsCount: await WithdrawRequest.countDocuments({
          status: "Pending",
        }),
      },
    });
  },
);

/**
 * Get Admin Earnings (Commissions List)
 */
export const getAdminEarnings = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const earnings = await Commission.find(query)
      .populate("order", "orderNumber")
      .populate("seller", "storeName sellerName")
      .populate("deliveryBoy", "name mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Commission.countDocuments(query);

    // Format data for frontend
    const formattedEarnings = earnings.map((e) => {
      let sourceName = "Unknown";
      if (e.type === "SELLER" && e.seller) {
        sourceName =
          (e.seller as any).storeName || (e.seller as any).sellerName;
      } else if (e.type === "DELIVERY_BOY" && e.deliveryBoy) {
        sourceName = (e.deliveryBoy as any).name;
      }

      return {
        id: e._id,
        source: sourceName,
        sourceType: e.type,
        amount: e.commissionAmount,
        date: e.createdAt,
        status: e.status,
        description: `Order #${(e.order as any)?.orderNumber || "Unknown"}`,
        orderId: (e.order as any)?._id,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedEarnings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  },
);

/**
 * Get All Wallet Transactions (Sellers & Delivery Boys)
 */
export const getWalletTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 20, type, userType, search: _search, userId } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (userType) query.userType = userType;
    if (userId) query.userId = userId;

    // Search handling not fully implemented for cross-collection ref

    const skip = (Number(page) - 1) * Number(limit);

    const transactions = await WalletTransaction.find(query)
      .populate({
        path: "userId", // This will populate based on refPath 'userType'
        select: "name firstName lastName storeName sellerName mobile email",
      })
      .populate("relatedOrder", "orderNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await WalletTransaction.countDocuments(query);

    // Format transactions to ensure user name is accessible
    const formattedTransactions = transactions.map((t: any) => {
      let userName = "Unknown";
      if (t.userId) {
        if (t.userType === "SELLER") {
          userName = t.userId.storeName || t.userId.sellerName;
        } else {
          userName =
            t.userId.name || t.userId.firstName + " " + t.userId.lastName;
        }
      }

      return {
        _id: t._id,
        type: t.type,
        userType: t.userType,
        userName: userName,
        userId: t.userId?._id,
        amount: t.amount,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
        reference: t.reference,
        relatedOrder: t.relatedOrder
          ? { orderNumber: t.relatedOrder.orderNumber }
          : undefined,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedTransactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  },
);

/**
 * Process Withdrawal Wrapper (to match frontend service expectation)
 */
export const processWithdrawalWrapper = asyncHandler(
  async (req: Request, res: Response) => {
    const { requestId, action, remark, transactionReference } = req.body;

    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        message: "Request ID and action are required",
      });
    }

    // Mock the params for the existing controllers
    req.params.id = requestId;

    if (action === "Approve") {
      return approveWithdrawal(req, res);
    } else if (action === "Reject") {
      req.body.remarks = remark; // Map 'remark' to 'remarks'
      return rejectWithdrawal(req, res);
    } else if (action === "Complete") {
      if (!transactionReference) {
        return res.status(400).json({
          success: false,
          message: "Transaction reference is required for completion",
        });
      }
      req.body.transactionReference = transactionReference;
      return completeWithdrawal(req, res);
    } else {
      return res.status(400).json({
        success: false,
      });
    }
  },
);

/**
 * Get Wallet Summary for all Delivery Boys (how much Admin owes them)
 */
export const getWalletSummary = asyncHandler(async (_req: Request, res: Response) => {
  const Delivery = (await import("../../../models/Delivery")).default;

  const deliveryBoys = await Delivery.find({ status: "Active" })
    .select("name mobile balance cashCollected profileImage")
    .sort({ balance: -1 });

  return res.status(200).json({
    success: true,
    data: deliveryBoys
  });
});

/**
 * Create Manual Wallet Transfer (Credit/Debit)
 */
export const createManualTransfer = asyncHandler(async (req: Request, res: Response) => {
  const { userId, userType, amount, type, description } = req.body;

  if (!userId || !userType || !amount || !type || !description) {
    return res.status(400).json({
      success: false,
      message: "Required fields: userId, userType, amount, type, description"
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let user;
    if (userType === 'DELIVERY_BOY') {
      const Delivery = (await import("../../../models/Delivery")).default;
      user = await Delivery.findById(userId).session(session);
    } else {
      const Seller = (await import("../../../models/Seller")).default;
      user = await Seller.findById(userId).session(session);
    }

    if (!user) {
      throw new Error(`${userType} not found`);
    }

    // Update balance
    if (type === 'Credit') {
      user.balance += amount;
    } else {
      if (user.balance < amount) {
        throw new Error("Insufficient balance for debit");
      }
      user.balance -= amount;
    }

    await user.save({ session });

    // Create transaction record
    const reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await WalletTransaction.create([{
      userId,
      userType,
      amount,
      type,
      description,
      status: 'Completed',
      reference
    }], { session });

    // Update Platform Wallet aggregates
    const PlatformWallet = (await import("../../../models/PlatformWallet")).default;
    const platformWallet = await PlatformWallet.findOne().session(session);
    if (platformWallet) {
      if (type === 'Credit') {
        if (userType === 'SELLER') {
          platformWallet.sellerPendingPayouts += amount;
        } else {
          platformWallet.deliveryBoyPendingPayouts += amount;
        }
      } else {
        // Debit means money leaving the platform
        platformWallet.currentPlatformBalance = Math.max(0, platformWallet.currentPlatformBalance - amount);
        if (userType === 'SELLER') {
          platformWallet.sellerPendingPayouts = Math.max(0, platformWallet.sellerPendingPayouts - amount);
        } else {
          platformWallet.deliveryBoyPendingPayouts = Math.max(0, platformWallet.deliveryBoyPendingPayouts - amount);
        }
      }
      await platformWallet.save({ session });
    }

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Transfer processed successfully",
      data: {
        newBalance: user.balance,
        reference
      }
    });

  } catch (error: any) {
    await session.abortTransaction();
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process transfer"
    });
  } finally {
    session.endSession();
  }
});
