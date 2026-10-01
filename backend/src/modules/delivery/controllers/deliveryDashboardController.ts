import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Delivery from "../../../models/Delivery";
import Order from "../../../models/Order";
import mongoose from "mongoose";

/**
 * Get Dashboard Stats
 * Returns: Daily Collection, Cash Balance, Pending Orders, All Orders, etc.
 */
export const getDashboardStats = asyncHandler(
  async (req: Request, res: Response) => {
    // Assuming user ID is attached to req.user by auth middleware
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Fetch Delivery Partner Details (for Cash Balance)
    const deliveryPartner = await Delivery.findById(deliveryId);
    if (!deliveryPartner) {
      return res.status(401).json({
        success: false,
        code: "DELIVERY_PARTNER_DELETED",
        message: "Delivery partner account is no longer available. Please log in again.",
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 2. Fetch Orders Assigned to this Partner
    // We need:
    // - Pending Orders (Ready for pickup, Out for delivery, Picked Up)
    // - Today's All Orders (Created today OR Delivered today?) -> "Today's All Order" usually means active + completed today
    // - Today's Delivered Orders (for Earnings & Collection)
    // - Return Orders

    const objectId = new mongoose.Types.ObjectId(deliveryId);

    // Aggregation to get counts in one go
    const stats = await Order.aggregate([
      {
        $match: {
          deliveryBoy: objectId,
          // We consider orders active or touching today
        },
      },
      {
        $group: {
          _id: null,
          // All Orders Today: Created today OR Updated today
          allOrdersToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$updatedAt", todayStart] },
                    { $lte: ["$updatedAt", todayEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          // Return Orders Today
          returnOrdersToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["Returned", "Cancelled"]] },
                    { $gte: ["$updatedAt", todayStart] },
                    { $lte: ["$updatedAt", todayEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      allOrdersToday: 0,
      returnOrdersToday: 0,
    };

    // Calculate Earnings (Real Logic from Commission Collection)
    const { default: Commission } = await import("../../../models/Commission");

    const earningStats = await Commission.aggregate([
      {
        $match: {
          deliveryBoy: objectId,
          type: "DELIVERY_BOY",
        },
      },
      {
        $facet: {
          today: [
            {
              $match: {
                createdAt: { $gte: todayStart, $lte: todayEnd },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$commissionAmount" },
              },
            },
          ],
          total: [
            {
              $group: {
                _id: null,
                total: { $sum: "$commissionAmount" },
              },
            },
          ],
        },
      },
    ]);

    const todayEarning = earningStats[0]?.today[0]?.total || 0;
    const totalEarning = earningStats[0]?.total[0]?.total || 0;

    // Daily Collection: Cash collected from COD orders delivered TODAY by this delivery partner
    let dailyCollectionAmount = 0;
    try {
      const CashCollection = (await import("../../../models/CashCollection")).default;
      const todayCollections = await CashCollection.aggregate([
        {
          $match: {
            deliveryBoy: objectId,
            createdAt: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalCollected: { $sum: "$amount" },
          },
        },
      ]);
      dailyCollectionAmount = todayCollections[0]?.totalCollected || 0;
    } catch (ccErr) {
      console.error("Error computing daily collection from CashCollection:", ccErr);
      dailyCollectionAmount = 0;
    }

    // Fetch assigned local-delivery candidates, then determine actionability
    // from the rider's fulfillment group rather than the mixed parent status.
    const pendingOrderCandidates = await Order.find({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
    })
      .populate("items")
      .select(
        "orderNumber customerName deliveryAddress status total grandTotal subtotal shipping items fulfillmentGroups orderType deliveryBoy estimatedDeliveryDate createdAt updatedAt",
      )
      .sort({ createdAt: -1 });

    const { getDeliveryPartnerQcContext } = await import(
      "../utils/deliveryOrderScopingHelper"
    );

    const scopedQcAssignments = pendingOrderCandidates
      .map((order) => ({ order, qcCtx: getDeliveryPartnerQcContext(order, deliveryId) }))
      .filter(({ qcCtx }) =>
        qcCtx.isAuthorized &&
        qcCtx.hasQcItems &&
        !qcCtx.isEcommerceOnly
      );
    const actionablePendingOrders = scopedQcAssignments.filter(({ qcCtx }) => qcCtx.isActionable);
    const completedQcAssignments = scopedQcAssignments.filter(
      ({ qcCtx }) => !qcCtx.isActionable && qcCtx.displayStatus === "Delivered",
    );
    const todayDeliveredCount = completedQcAssignments.filter(({ order }) => {
      const completedAt = new Date(order.updatedAt || order.createdAt);
      return completedAt >= todayStart && completedAt <= todayEnd;
    }).length;

    // Format only active QC assignments for the dashboard preview.
    const formattedPendingList = actionablePendingOrders.slice(0, 5).map(({ order, qcCtx }) => {
      const displayTotal = qcCtx.hasQcItems ? qcCtx.assignedQcTotal : 0;
      return {
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        status: qcCtx.displayStatus || order.status,
        address: order.deliveryAddress ? `${order.deliveryAddress.address}, ${order.deliveryAddress.city}` : "N/A",
        totalAmount: displayTotal,
        estimatedDeliveryTime: order.estimatedDeliveryDate
          ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "N/A",
      };
    });

    // Fetch Wallet Balance
    let walletBalance = 0;
    try {
      const {
        getWalletBalance,
      } = require("../../../services/walletManagementService");
      walletBalance = await getWalletBalance(deliveryId, "DELIVERY_BOY");
    } catch (error) {
      console.error("Error fetching wallet balance for dashboard:", error);
    }

    // Fetch count of Return Pickups assigned to this delivery partner
    let activeReturnPickupsCount = 0;
    try {
      const { default: ReturnModel } = await import("../../../models/Return");
      activeReturnPickupsCount = await ReturnModel.countDocuments({
        deliveryBoy: objectId,
        status: { $in: ["Delivery Partner Assigned", "Picked Up", "In Transit", "Handed To Seller"] },
      });
    } catch (err) {
      console.error("Error fetching return pickup count:", err);
    }

    return res.status(200).json({
      success: true,
      data: {
        dailyCollection: dailyCollectionAmount,
        cashBalance: deliveryPartner.cashCollected, // This field stores total cash holding
        pendingOrders: actionablePendingOrders.length,
        allOrders: result.allOrdersToday,
        returnOrders: activeReturnPickupsCount || result.returnOrdersToday,
        returnItems: activeReturnPickupsCount,
        todayEarning: todayEarning,
        totalEarning: totalEarning,
        walletBalance: walletBalance,
        todayDeliveredCount,
        totalDeliveredCount: completedQcAssignments.length,
        pendingOrdersList: formattedPendingList,
      },
    });

  },
);

/**
 * Get Help & Support Data (Dynamic from MongoDB FAQ & AppSettings)
 */
export const getHelpSupport = asyncHandler(
  async (_req: Request, res: Response) => {
    let faqItems: any[] = [];
    try {
      const { default: FAQ } = await import("../../../models/FAQ");
      const dbFaqs = await FAQ.find({ status: "Active" }).sort({ order: 1, createdAt: -1 });
      if (dbFaqs.length > 0) {
        faqItems = dbFaqs.map((f) => ({
          question: f.question,
          answer: f.answer,
          category: f.category || "General",
        }));
      }
    } catch (faqErr) {
      console.error("Error fetching FAQs for delivery support:", faqErr);
    }

    if (faqItems.length === 0) {
      faqItems = [
        {
          question: "How do I accept a new order?",
          answer:
            'When you receive a new order notification, tap on it to view order details. Click "Accept Order" to confirm.',
        },
        {
          question: "What should I do if I cannot deliver an order?",
          answer:
            'Contact the customer first. If unable to reach them, mark the order as "Unable to Deliver" and contact support.',
        },
        {
          question: "How are my earnings calculated?",
          answer:
            "You earn delivery commissions based on configured distance or percentage rates. View details in Wallet.",
        },
        {
          question: "How do I update my profile information?",
          answer:
            'Go to Menu > Profile and tap "Edit Profile" to update your personal details, vehicle information, and UPI ID.',
        },
      ];
    }

    let phone = "+91 7846940429";
    let email = "support@dhakadsnazzy.com";

    try {
      const { default: AppSettings } = await import("../../../models/AppSettings");
      const settings = await AppSettings.findOne();
      if (settings) {
        if (settings.supportPhone || settings.contactPhone) {
          phone = settings.supportPhone || settings.contactPhone;
        }
        if (settings.supportEmail || settings.contactEmail) {
          email = settings.supportEmail || settings.contactEmail;
        }
      }
    } catch (settingsErr) {
      console.error("Error fetching AppSettings for delivery support:", settingsErr);
    }

    const contactOptions = [
      { label: "Call Support", value: phone, icon: "phone" },
      { label: "Email Support", value: email, icon: "email" },
      { label: "Live Chat", value: "Available 24/7", icon: "chat" },
    ];

    return res.status(200).json({
      success: true,
      data: {
        faqs: faqItems,
        contact: contactOptions,
      },
    });
  },
);
