import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import { asyncHandler } from "../../../utils/asyncHandler";
import { resolveAuthorizedSellerChannel } from "../../../utils/sellerChannelHelper";
import { recomputeOrderFulfillment } from "../../../services/orderFulfillmentOrchestrator";
import { Server as SocketIOServer } from "socket.io";
import {
  calculateCODOrderBreakdown,
  getOrderEarningBreakdown,
} from "../../../services/commissionService";
import { getSellerPendingOrderAlerts } from "../../../services/orderAlertService";

/**
 * Get pending order alerts that require seller action (survives page refresh).
 */
export const getPendingOrderAlerts = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const alerts = await getSellerPendingOrderAlerts(sellerId);

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  },
);

/**
 * Get seller's orders with filters, sorting, and pagination
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    dateFrom,
    dateTo,
    status,
    search,
    channel,
    page = "1",
    limit = "10",
    sortBy = "orderDate",
    sortOrder = "desc",
  } = req.query;

  // Authoritatively validate requested channel against seller.vendorType
  const resolution = await resolveAuthorizedSellerChannel(sellerId, channel as string);
  if (resolution.error) {
    return res.status(resolution.statusCode || 400).json({
      success: false,
      message: resolution.error,
    });
  }

  const { activeChannel } = resolution.data!;

  const itemFilter: any = { seller: sellerId };
  if (activeChannel) {
    const relevantProductIds = await Product.find({
      seller: sellerId,
      productType: activeChannel,
    }).distinct("_id");
    itemFilter.product = { $in: relevantProductIds };
  }

  // Find all order IDs that contain items from this seller matching the active channel
  const orderItems = await OrderItem.find(itemFilter).distinct(
    "order",
  );

  // Build query - filter by orders containing this seller's items
  const query: any = { _id: { $in: orderItems }, status: { $ne: "Pending" } };

  // Date range filter
  if (dateFrom || dateTo) {
    query.orderDate = {};
    if (dateFrom) {
      query.orderDate.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      query.orderDate.$lte = new Date(dateTo as string);
    }
  }

  // Status filter
  if (status && status !== "All Status") {
    if (status === "Tracking") {
      if (activeChannel === "ECOMMERCE") {
        // Ecommerce courier shipment tracking (orders in transit/shipped/processing/accepted)
        query.status = {
          $in: ["Processing", "Shipped", "On the way", "Out for Delivery", "Accepted"],
        };
      } else {
        // Quick Commerce local delivery partner tracking
        query.deliveryBoy = { $exists: true, $ne: null };
        query.status = {
          $nin: ["Delivered", "Cancelled", "Rejected", "Returned"],
        };
      }
    } else {
      // Map frontend status to backend status
      const statusMapping: Record<string, string> = {
        Pending: "Pending",
        Accepted: "Accepted",
        "On the way": "On the way",
        Delivered: "Delivered",
        Cancelled: "Cancelled",
        Rejected: "Rejected",
      };
      query.status = statusMapping[status as string] || status;
    }
  }

  // Search filter
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { invoiceNumber: { $regex: search, $options: "i" } },
      { "deliveryAddress.name": { $regex: search, $options: "i" } },
      { "deliveryAddress.phone": { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  // Get orders with populated customer and delivery info
  const orders = await Order.find(query)
    .populate("customer", "name email phone")
    .populate("deliveryBoy", "name mobile")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination
  const total = await Order.countDocuments(query);

  // Format response for frontend - scoped strictly to this authenticated seller's items & groups
  const orderIds = orders.map((o) => o._id);
  const allSellerItems = await OrderItem.find({
    order: { $in: orderIds },
    seller: sellerId,
  }).populate("product", "productType");

  const itemsByOrderId = new Map<string, any[]>();
  for (const it of allSellerItems) {
    const oId = it.order.toString();
    if (!itemsByOrderId.has(oId)) itemsByOrderId.set(oId, []);
    itemsByOrderId.get(oId)!.push(it);
  }

  const formattedOrders = orders.map((order) => {
    const sellerItemsForOrder = itemsByOrderId.get(order._id.toString()) || [];
    const sellerItemIds = new Set(sellerItemsForOrder.map((it: any) => it._id.toString()));

    const sellerScopedGroups = (order.fulfillmentGroups || []).filter((g: any) => {
      const isOwnSeller = g.seller && g.seller.toString() === sellerId.toString();
      const hasOwnItems = Array.isArray(g.items) && g.items.some((itId: any) => sellerItemIds.has(itId.toString()));
      return isOwnSeller || hasOwnItems;
    });

    let sellerHasQc = false;
    let sellerHasEcom = false;
    for (const it of sellerItemsForOrder) {
      const prod = it.product as any;
      const group = (order.fulfillmentGroups || []).find((g: any) =>
        Array.isArray(g.items) && g.items.some((itId: any) => itId.toString() === it._id.toString())
      );
      const isEcom = group
        ? group.fulfillmentType === 'COURIER_SHIPPING' || group.fulfillmentType === 'THIRD_PARTY_API'
        : (prod?.productType === 'ECOMMERCE' || (order.orderType === 'ECOMMERCE'));
      if (isEcom) {
        sellerHasEcom = true;
      } else {
        sellerHasQc = true;
      }
    }

    const isMixedOrder = sellerHasQc && sellerHasEcom;
    const isPureQc = sellerHasQc && !sellerHasEcom;
    const isPureEcommerce = sellerHasEcom && !sellerHasQc;

    const qcGroup = sellerScopedGroups.find((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY');
    const ecomGroup = sellerScopedGroups.find((g: any) => g.fulfillmentType === 'COURIER_SHIPPING' || g.fulfillmentType === 'THIRD_PARTY_API');

    const qcItemCount = qcGroup?.items?.filter((id: any) => sellerItemIds.has(id.toString())).length || (isPureQc ? sellerItemsForOrder.length : 0);
    const ecomItemCount = ecomGroup?.items?.filter((id: any) => sellerItemIds.has(id.toString())).length || (isPureEcommerce ? sellerItemsForOrder.length : 0);

    const fulfillmentSummary = {
      type: isMixedOrder ? 'MIXED' : isPureQc ? 'QUICK_COMMERCE' : 'ECOMMERCE',
      hasQuickCommerce: sellerHasQc,
      hasEcommerce: sellerHasEcom,
      isMixed: isMixedOrder,
      isPureQc,
      isPureEcommerce,
      quickCommerceItemCount: qcItemCount,
      ecommerceItemCount: ecomItemCount,
      qcStatus: qcGroup?.status,
      ecomStatus: ecomGroup?.status,
    };

    const sellerTotal = sellerItemsForOrder.reduce((sum: number, it: any) => sum + (it.total || 0), 0);

    return {
      id: order._id,
      orderId: order.orderNumber,
      deliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
        : order.orderDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
      orderDate: order.orderDate.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: order.status === "On the way" ? "On the way" : order.status,
      amount: sellerTotal > 0 ? sellerTotal : order.total,
      orderTotal: order.total,
      customerName: (order.customer as any)?.name || order.customerName || "",
      customerPhone: (order.customer as any)?.phone || order.customerPhone || "",
      deliveryBoyName: sellerHasQc ? ((order.deliveryBoy as any)?.name || (order.deliveryPreference === 'Self' ? 'Self Assign' : "")) : "",
      deliveryBoyPhone: sellerHasQc ? ((order.deliveryBoy as any)?.mobile || "") : "",
      deliveryPreference: sellerHasQc ? order.deliveryPreference : undefined,
      paymentMethod: order.paymentMethod,
      orderType: isMixedOrder ? 'MIXED' : isPureQc ? 'QUICK_COMMERCE' : 'ECOMMERCE',
      parentOrderType: order.orderType,
      trackingNumber: order.trackingNumber || "",
      fulfillmentGroups: sellerScopedGroups,
      fulfillmentSummary,
      hasQcItems: sellerHasQc,
      hasEcomItems: sellerHasEcom,
      requiresLocalDelivery: sellerHasQc,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Orders fetched successfully",
    data: formattedOrders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Settlement page: list seller's delivered orders with COD breakdown.
 * settlementStatus=pending (default): only orders where COD not yet paid to admin (so list "hat jata hai" after pay).
 * settlementStatus=settled: only COD orders already paid to admin. all: no filter.
 */
export const getSettlementOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 20, settlementStatus = "pending" } = req.query;
    const orderIds = await OrderItem.find({ seller: sellerId }).distinct("order");
    const query: any = { _id: { $in: orderIds }, status: "Delivered", paymentMethod: "COD" };
    if (settlementStatus === "pending") {
      query.codPaidToAdminAt = null;
    } else if (settlementStatus === "settled") {
      query.codPaidToAdminAt = { $ne: null };
    }
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const orders = await Order.find(query)
      .select("orderNumber orderDate paymentMethod total shipping deliveryPreference status codPaidToAdminAt")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();
    const total = await Order.countDocuments(query);

    const ordersWithBreakdown = await Promise.all(
      orders.map(async (order: any) => {
        let codBreakdown = null;
        if (order.paymentMethod === "COD") {
          try {
            const full = await calculateCODOrderBreakdown(order._id.toString());
            const myEarning = full.sellerEarnings.get(sellerId) ?? 0;
            codBreakdown = {
              orderId: full.orderId,
              orderNumber: full.orderNumber,
              adminProductCommission: full.adminProductCommission,
              platformFee: full.platformFee,
              totalDeliveryCharge: full.totalDeliveryCharge,
              deliveryBoyCommission: full.deliveryBoyCommission,
              isSelfAssign: full.isSelfAssign,
              totalAdminEarning: full.totalAdminEarning,
              yourEarning: myEarning,
              note: full.isSelfAssign
                ? "Self Assign: Delivery charge added to your earning. Delivery boy has no share."
                : "Amount to pay admin & your earning.",
            };
          } catch {
            // ignore
          }
        }
        return { order, codBreakdown };
      }),
    );

    return res.status(200).json({
      success: true,
      data: {
        orders: ordersWithBreakdown,
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  },
);

/**
 * Helper to resolve Order by either MongoDB _id or orderNumber
 */
const findOrderByIdOrNumber = async (id: string, selectFields?: string) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id };
  const q = Order.findOne(query);
  if (selectFields) {
    q.select(selectFields);
  }
  return q;
};

/**
 * Get COD order breakdown for seller (admin commission visible; Self Assign = delivery boy gets nothing)
 */
export const getOrderCODBreakdown = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const order = await findOrderByIdOrNumber(id, "paymentMethod deliveryPreference");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const hasItems = await OrderItem.findOne({ order: order._id, seller: sellerId });
    if (!hasItems) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "COD breakdown is only available for COD orders",
      });
    }
    const breakdown = await calculateCODOrderBreakdown(order._id.toString());
    const myEarning = breakdown.sellerEarnings.get(sellerId) ?? 0;
    return res.status(200).json({
      success: true,
      data: {
        orderId: breakdown.orderId,
        orderNumber: breakdown.orderNumber,
        adminProductCommission: breakdown.adminProductCommission,
        platformFee: breakdown.platformFee,
        totalDeliveryCharge: breakdown.totalDeliveryCharge,
        deliveryBoyCommission: breakdown.deliveryBoyCommission,
        isSelfAssign: breakdown.isSelfAssign,
        totalAdminEarning: breakdown.totalAdminEarning,
        yourEarning: myEarning,
        note: breakdown.isSelfAssign
          ? "Self Assign: Delivery charge added to seller earning. Delivery boy has no share."
          : "Admin commission and your earning for this COD order.",
      },
    });
  },
);

/**
 * Get earning breakdown for this order (COD or Online): your earning, admin commission, delivery (Self = you get delivery charge)
 */
export const getOrderEarningBreakdownSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const order = await findOrderByIdOrNumber(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const hasItems = await OrderItem.findOne({ order: order._id, seller: sellerId });
    if (!hasItems) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const breakdown = await getOrderEarningBreakdown(order._id.toString());
    const yourEarning = breakdown.sellerEarnings.get(sellerId) ?? 0;
    const payload = {
      orderId: breakdown.orderId,
      orderNumber: breakdown.orderNumber,
      adminProductCommission: breakdown.adminProductCommission,
      platformFee: breakdown.platformFee,
      totalDeliveryCharge: breakdown.totalDeliveryCharge,
      deliveryBoyCommission: breakdown.deliveryBoyCommission,
      isSelfAssign: breakdown.isSelfAssign,
      totalAdminEarning: breakdown.totalAdminEarning,
      yourEarning,
      note: breakdown.isSelfAssign
        ? "Self Assign: Delivery charge is included in your earning. Delivery partner has no share."
        : "Delivery partner gets delivery share. Your earning is from product sale (after commission).",
    };
    return res.status(200).json({ success: true, data: payload });
  },
);

/**
 * Seller marks COD as paid to admin (order will leave pending settlement list)
 */
export const markOrderCODPaidSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const order = await findOrderByIdOrNumber(id, "paymentMethod status codPaidToAdminAt");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const hasItems = await OrderItem.findOne({ order: order._id, seller: sellerId });
    if (!hasItems) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentMethod !== "COD") {
      return res.status(400).json({ success: false, message: "Only COD orders can be marked as paid" });
    }
    if (order.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders appear in settlement. Mark the order as Delivered first, then you can mark as paid to admin.",
      });
    }
    if (order.codPaidToAdminAt) {
      return res.status(400).json({ success: false, message: "COD for this order is already marked as paid" });
    }
    order.codPaidToAdminAt = new Date();
    await order.save();
    return res.status(200).json({
      success: true,
      message: "Marked as paid to admin. This order will no longer appear in your pending settlement list.",
      data: { orderId: order._id, codPaidToAdminAt: order.codPaidToAdminAt },
    });
  },
);

/**
 * Get order by ID with populated order items, customer, and delivery info
 */
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // Resolve order document whether id is MongoDB ObjectId or orderNumber (e.g. ORD1789980388371771)
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const order = await Order.findOne(
      isObjectId ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id }
    )
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email")
      .populate("fulfillmentGroups.deliveryBoy", "name mobile email vehicleNumber vehicleType");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if this seller has items in this order using resolved order._id
    const sellerItems = await OrderItem.find({ order: order._id, seller: sellerId })
      .populate("seller", "storeName")
      .populate("product");

    if (!sellerItems || sellerItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get only this seller's order items
    const orderItems = sellerItems;
    const sellerItemIds = new Set(orderItems.map((it) => it._id.toString()));

    // Filter fulfillment groups to ONLY groups containing this seller's items
    const sellerScopedGroups = (order.fulfillmentGroups || []).filter((g: any) => {
      const isOwnSeller = g.seller && g.seller.toString() === sellerId.toString();
      const hasOwnItems = Array.isArray(g.items) && g.items.some((itId: any) => sellerItemIds.has(itId.toString()));
      return isOwnSeller || hasOwnItems;
    });

    let sellerHasQc = false;
    let sellerHasEcom = false;

    // Format order items for frontend
    const formattedItems = orderItems.map((item) => {
      let unit = item.variation || "N/A";
      let variationMatched = false;

      // Try to resolve variation value from product if it exists
      const product = item.product as any;
      if (product && product.variations && Array.isArray(product.variations)) {
        // 1. Try to match by ID or Value if validation is present
        if (item.variation) {
          const variationById = product.variations.find(
            (v: any) => v._id.toString() === item.variation,
          );
          if (variationById) {
            unit = variationById.value;
            variationMatched = true;
          } else {
            const variationByValue = product.variations.find(
              (v: any) => v.value === item.variation,
            );
            if (variationByValue) {
              unit = variationByValue.value;
              variationMatched = true;
            }
          }
        }

        // 2. Fallback: If not matched yet (even if we have a value like '250'), try to recover
        if (!variationMatched) {
          const variationByPrice = product.variations.find(
            (v: any) =>
              v.price === item.unitPrice || v.discPrice === item.unitPrice,
          );
          if (variationByPrice) {
            unit = variationByPrice.value;
            variationMatched = true;
          } else if (product.variations.length === 1) {
            unit = product.variations[0].value;
          }
        }
      }

      // Determine item fulfillment channel safely
      const group = (order.fulfillmentGroups || []).find((g: any) =>
        Array.isArray(g.items) && g.items.some((itId: any) => itId.toString() === item._id.toString())
      );
      const isEcom = group
        ? group.fulfillmentType === 'COURIER_SHIPPING' || group.fulfillmentType === 'THIRD_PARTY_API'
        : ((product as any)?.productType === 'ECOMMERCE' || (order.orderType === 'ECOMMERCE'));

      if (isEcom) {
        sellerHasEcom = true;
      } else {
        sellerHasQc = true;
      }

      return {
        id: item._id,
        srNo: item._id.toString().slice(-4), // Use last 4 chars of ID as srNo
        product: item.productName || "Unknown Product",
        soldBy: (item.seller as any)?.storeName || "N/A",
        unit: unit,
        price: item.unitPrice || 0,
        tax: 0,
        taxPercent: 0,
        qty: item.quantity || 0,
        subtotal: item.total || 0,
        productType: isEcom ? 'ECOMMERCE' : 'QUICK_COMMERCE',
        fulfillmentType: isEcom ? 'COURIER_SHIPPING' : 'LOCAL_DELIVERY',
        isWholesale: Boolean(item.isWholesale),
        wholesalePrice: item.wholesalePrice,
        wholesaleMinimumQuantity: item.wholesaleMinimumQuantity,
      };
    });

    const isMixedOrder = sellerHasQc && sellerHasEcom;
    const sellerOrderType = isMixedOrder ? 'MIXED' : sellerHasQc ? 'QUICK_COMMERCE' : 'ECOMMERCE';

    // Format order data for frontend - strictly scoped to this seller
    const orderDetail = {
      id: order._id,
      orderType: sellerOrderType,
      parentOrderType: order.orderType || "QUICK_COMMERCE",
      fulfillmentGroups: sellerScopedGroups,
      trackingNumber: order.trackingNumber || "",
      invoiceNumber: order.invoiceNumber || order.orderNumber || "N/A",
      orderDate: order.orderDate
        ? order.orderDate.toISOString()
        : new Date().toISOString(),
      deliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      timeSlot: order.timeSlot || "N/A",
      status: order.status === "On the way" ? "Out For Delivery" : order.status,
      customerName: (order.customer as any)?.name || order.customerName || "",
      customerEmail:
        (order.customer as any)?.email || order.customerEmail || "",
      deliveryBoyName: sellerHasQc
        ? ((order.deliveryBoy as any)?.name || 
           (sellerScopedGroups.find((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY')?.deliveryBoy as any)?.name || 
           (order.deliveryPreference === 'Self' ? 'Self Assign' : ''))
        : '',
      deliveryBoyPhone: sellerHasQc
        ? ((order.deliveryBoy as any)?.mobile || 
           (sellerScopedGroups.find((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY')?.deliveryBoy as any)?.mobile || '')
        : '',
      deliveryPreference: sellerHasQc ? order.deliveryPreference : undefined,
      deliveryOption: order.deliveryOption,
      items: formattedItems,
      subtotal: formattedItems.reduce((sum, it) => sum + it.subtotal, 0),
      orderSubtotal: order.subtotal || 0,
      tax: order.tax || 0,
      grandTotal: formattedItems.reduce((sum, it) => sum + it.subtotal, 0),
      orderGrandTotal: order.total || 0,
      paymentMethod: order.paymentMethod || "N/A",
      paymentStatus: order.paymentStatus || "Pending",
      deliveryAddress: order.deliveryAddress || {},
      hasQcItems: sellerHasQc,
      hasEcomItems: sellerHasEcom,
      requiresLocalDelivery: sellerHasQc,
    };

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: orderDetail,
    });
  },
);

/**
 * Update order status (seller can update: Accepted, On the way, Delivered, Cancelled)
 * Supports multi-seller orders: delivery boys notified only after ALL sellers respond.
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { status, deliveryPreference } = req.body;

    // Validate allowed status updates for seller
    const allowedStatuses = [
      "Accepted",
      "On the way",
      "Delivered",
      "Cancelled",
      "Rejected",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Seller can only update to: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await findOrderByIdOrNumber(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if this seller has items in this order
    const sellerItems = await OrderItem.findOne({
      order: order._id,
      seller: sellerId,
    });

    if (!sellerItems) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorized to manage this order",
      });
    }

    const previousStatus = order.status;

    // Allow same status only when updating deliveryPreference or in multi-seller acceptance phase
    if (order.status === status && !deliveryPreference && status !== "Accepted" && status !== "Rejected") {
      return res.status(400).json({
        success: false,
        message: `Order is already ${status}`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-SELLER ACCEPTANCE / REJECTION LOGIC
    // ─────────────────────────────────────────────────────────────────────────
    if (status === "Accepted" || status === "Rejected") {
      const sellerIdStr = sellerId.toString();

      // Step 1: Mark all items of this seller with the new sellerStatus
      await OrderItem.updateMany(
        { order: order._id, seller: sellerId },
        { $set: { sellerStatus: status } }
      );
      // If rejecting: also mark items as Cancelled
      if (status === "Rejected") {
        await OrderItem.updateMany(
          { order: order._id, seller: sellerId },
          { $set: { status: "Cancelled" } }
        );
        console.log(`\n[SELLER REJECT]\nOrder ID: ${order._id}\nSeller ID: ${sellerIdStr}\nPayment Method: ${order.paymentMethod}\nPayment Status: ${order.paymentStatus}\nRazorpay Payment ID: ${order.paymentId || 'N/A'}`);
        console.log(`🚫 [MULTI-SELLER] Seller ${sellerIdStr} rejected order ${order.orderNumber}. Their items cancelled.`);
      }

      // Step 3: Record this seller's response on the Order document
      if (!order.sellerResponses) order.sellerResponses = [];
      const mongoose = await import("mongoose");
      const sellerObjId = new mongoose.Types.ObjectId(sellerIdStr);
      const existingIdx = (order.sellerResponses as any[]).findIndex(
        (r: any) => r.seller.toString() === sellerIdStr
      );
      if (existingIdx >= 0) {
        (order.sellerResponses as any[])[existingIdx].status = status;
        (order.sellerResponses as any[])[existingIdx].respondedAt = new Date();
      } else {
        (order.sellerResponses as any[]).push({ seller: sellerObjId, status, respondedAt: new Date() });
      }

      // Check if this seller has QC items requiring local delivery assignment
      const qcGroup = (order.fulfillmentGroups || []).find((g: any) => g.fulfillmentType === "LOCAL_DELIVERY");
      const sellerHasQcItem = qcGroup ? await OrderItem.exists({
        order: order._id,
        seller: sellerId,
        _id: { $in: qcGroup.items },
      }) : (order.orderType === "QUICK_COMMERCE");

      // Apply delivery preference ONLY if this seller actually owns QC items!
      if (deliveryPreference && status === "Accepted" && sellerHasQcItem) {
        if (order.deliveryOption === "Instant" && deliveryPreference === "Admin") {
          order.deliveryPreference = undefined;
        } else {
          order.deliveryPreference = deliveryPreference as "Self" | "Admin";
        }
        if (deliveryPreference === "Self") {
          order.deliveryBoy = undefined;
        }
      }

      // For Ecommerce fulfillment groups belonging to this seller: advance Pending to Processing on Accept
      if (status === "Accepted" && order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
        const sellerItemsList = await OrderItem.find({ order: order._id, seller: sellerId }).select('_id');
        const sellerItemIds = new Set(sellerItemsList.map((i: any) => i._id.toString()));

        for (const fg of order.fulfillmentGroups) {
          const isOwnGroup = (fg.seller && fg.seller.toString() === sellerIdStr) ||
            (Array.isArray(fg.items) && fg.items.some((itId: any) => sellerItemIds.has(itId.toString())));
          if (isOwnGroup && (fg.fulfillmentType === 'COURIER_SHIPPING' || fg.fulfillmentType === 'THIRD_PARTY_API')) {
            if (fg.status === 'Pending') {
              fg.status = 'Processing';
            }
            if (order.paymentStatus === 'Paid' || order.paymentMethod === 'COD') {
              try {
                const { createEcommerceShipment } = await import("../../../services/shipping/shippingService");
                await createEcommerceShipment(order._id.toString(), fg.groupId);
              } catch (shipErr) {
                console.warn(`Shipment creation on seller accept (${fg.groupId}):`, (shipErr as any)?.message);
              }
            }
          }
        }
      }
      await order.save();

      const io: SocketIOServer = req.app?.get ? (req.app.get("io") as SocketIOServer) : (null as any);
      const fulfillment = await recomputeOrderFulfillment(id, io);

      if (fulfillment.outcome === "all_rejected") {
        console.log(`❌ [MULTI-SELLER] All sellers rejected order ${order.orderNumber}. Fully cancelled.`);
        if (order.firstOrderFreeShippingApplied) {
          try {
            const { releaseFirstOrderFreeShippingClaim } = await import("../../../services/shipping/shippingPromotionService");
            const custId = (order.customer as any)?._id || order.customer;
            await releaseFirstOrderFreeShippingClaim(custId);
          } catch (relErr) {
            console.error("Error releasing first order free shipping claim on seller all_rejected:", relErr);
          }
        }
      } else if (fulfillment.outcome === "ready_for_delivery") {
        console.log(`✅ [MULTI-SELLER] Seller resolution complete for ${order.orderNumber}. Delivery assignment flow started.`);
      } else if (fulfillment.outcome === "self_delivery") {
        console.log(`🚚 [MULTI-SELLER] Seller resolution complete for ${order.orderNumber}. Order remains self-delivery.`);
      } else {
        console.log(`⏳ [MULTI-SELLER] Waiting for remaining seller responses on ${order.orderNumber}.`);
      }

    } else {
      // ──────────────────────────────────────────────────────────────────────
      // NON-ACCEPT/REJECT STATUS UPDATES (On the way, Delivered, Cancelled)
      // These are unchanged from the original logic for full compatibility
      // ──────────────────────────────────────────────────────────────────────
      if (order.status !== status) {
        order.status = status;
      }

      if (deliveryPreference && (status === "Accepted" || order.status === "Accepted")) {
        if (order.deliveryOption === "Instant" && deliveryPreference === "Admin") {
          order.deliveryPreference = undefined;
        } else {
          order.deliveryPreference = deliveryPreference as "Self" | "Admin";
        }
        if (deliveryPreference === "Self") {
          order.deliveryBoy = undefined;
        }
      }

      await order.save();

      // ─── PRE-FULFILLMENT CANCELLATION REFUND ────────────────────────────
      // Trigger refund for ALL payment combinations where customer actually paid.
      // BUG FIX: Old code only triggered for paymentMethod === "Online",
      // causing wallet-only orders to lose money on seller cancellation.
      if (status === "Cancelled") {
        if (order.firstOrderFreeShippingApplied) {
          try {
            const { releaseFirstOrderFreeShippingClaim } = await import(
              "../../../services/shipping/shippingPromotionService"
            );
            const custId = (order.customer as any)?._id || order.customer;
            await releaseFirstOrderFreeShippingClaim(custId);
          } catch (relErr) {
            console.error("Error releasing first order free shipping claim on seller cancellation:", relErr);
          }
        }

        const customerActuallyPaid =
          (order.walletAmountUsed && order.walletAmountUsed > 0) ||
          (order.onlineAmountPaid && order.onlineAmountPaid > 0);

        if (customerActuallyPaid && order.paymentStatus !== "Refunded") {
          try {
            const { handleOnlineOrderCancellation } = await import(
              "../../../services/refundSettlementService"
            );
            // handleOnlineOrderCancellation handles all cases:
            //   walletAmountUsed > 0 → Customer Wallet credit
            //   onlineAmountPaid > 0 → Razorpay refund
            //   COD (both = 0)       → No refund needed
            await handleOnlineOrderCancellation(
              order._id.toString(),
              "Order cancelled by seller"
            );
            console.log(`[Seller Cancel] Refund issued for order ${order.orderNumber} (wallet: ₹${order.walletAmountUsed || 0}, online: ₹${order.onlineAmountPaid || 0})`);
          } catch (refundErr) {
            console.error("Error issuing refund on seller cancellation:", refundErr);
          }
        }

        // Always cancel stale commission records on any cancellation
        // (covers COD orders where handleOnlineOrderCancellation is not called)
        try {
          const Commission = (await import("../../../models/Commission")).default;
          await Commission.updateMany(
            { order: order._id, status: { $in: ["Pending", "OnHold"] } },
            { $set: { status: "Cancelled" } }
          );
        } catch (commErr) {
          console.error("Error cancelling commissions on seller cancellation:", commErr);
        }
      }
    }

    // Distribute commissions on delivery (unchanged)
    if (status === "Delivered" && previousStatus !== "Delivered") {
      try {
        const { distributeCommissions } = await import(
          "../../../services/commissionService"
        );
        await distributeCommissions(order._id.toString());
      } catch (commissionError) {
        console.error("Error distributing commissions on seller delivery:", commissionError);
      }
    }

    // Send status update notification to customer
    if (order.customer && previousStatus !== order.status) {
      try {
        const { sendOrderStatusNotification } = await import(
          "../../../services/notificationService"
        );
        const io: SocketIOServer = req.app?.get ? (req.app.get("io") as SocketIOServer) : (null as any);
        const customerId = (order.customer as any)._id?.toString() || order.customer.toString();
        if (io) {
          sendOrderStatusNotification(order._id.toString(), customerId, order.status, io).catch((e) =>
            console.error("Error sending customer order status notification:", e)
          );
        }
      } catch (notifErr) {
        console.error("Error importing notificationService:", notifErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        id: order._id,
        status: order.status,
      },
    });
  },
);

/**
 * Get available delivery partners for seller manual assignment
 */
export const getAvailableDeliveryPartners = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.userId;
    const { id } = req.params;

    // Verify order exists and seller has items in it
    const order = await findOrderByIdOrNumber(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const sellerItems = await OrderItem.findOne({ order: order._id, seller: sellerId });
    if (!sellerItems) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view delivery partners for this order",
      });
    }

    // Channel guard: Local delivery assignment is only applicable for Quick Commerce orders
    if (order.orderType === "ECOMMERCE") {
      return res.status(400).json({
        success: false,
        message: "Local delivery assignment is only applicable for Quick Commerce orders. Ecommerce orders are fulfilled via courier shipping.",
      });
    }

    // Check if seller is ECOMMERCE only
    const Seller = (await import("../../../models/Seller")).default;
    const seller = await Seller.findById(sellerId).select("latitude longitude serviceRadiusKm vendorType");
    if (seller?.vendorType === "ECOMMERCE") {
      return res.status(400).json({
        success: false,
        message: "ECOMMERCE-only vendors cannot assign local delivery partners. Use courier shipping.",
      });
    }

    // In a MIXED or multi-group order, verify order has a LOCAL_DELIVERY fulfillment group
    if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
      const qcGroup = order.fulfillmentGroups.find(
        (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
      );
      if (!qcGroup) {
        return res.status(400).json({
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
        });
      }

      // Verify seller owns items in the QC group
      const sellerHasQcItem = await OrderItem.exists({
        order: order._id,
        seller: sellerId,
        _id: { $in: qcGroup.items },
      });
      if (!sellerHasQcItem) {
        return res.status(400).json({
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
        });
      }
    }

    // Get seller location for proximity calculation
    const sellerLat = seller?.latitude ? parseFloat(seller.latitude) : null;
    const sellerLng = seller?.longitude ? parseFloat(seller.longitude) : null;

    // Fetch active & online delivery partners
    const Delivery = (await import("../../../models/Delivery")).default;
    const deliveryBoys = await Delivery.find({
      status: "Active",
      isOnline: true,
      available: "Available",
    }).select("name mobile email vehicleNumber vehicleType isOnline available status location profileImage");

    // Count active in-progress orders for each delivery boy
    const busyOrders = await Order.find({
      deliveryBoy: { $in: deliveryBoys.map((d) => d._id) },
      deliveryBoyStatus: { $in: ["Assigned", "Picked Up", "In Transit"] },
      status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
    }).select("deliveryBoy");

    const riderOrderCounts: Record<string, number> = {};
    busyOrders.forEach((o) => {
      const id = o.deliveryBoy?.toString();
      if (id) {
        riderOrderCounts[id] = (riderOrderCounts[id] || 0) + 1;
      }
    });

    const { calculateDistance } = await import("../../../utils/locationHelper");

    const formattedRiders = deliveryBoys.map((rider) => {
      let distanceKm: number | null = null;
      if (
        sellerLat !== null &&
        sellerLng !== null &&
        rider.location?.coordinates &&
        rider.location.coordinates.length === 2
      ) {
        const [riderLng, riderLat] = rider.location.coordinates;
        distanceKm = Math.round(calculateDistance(sellerLat, sellerLng, riderLat, riderLng) * 10) / 10;
      }

      const activeOrdersCount = riderOrderCounts[rider._id.toString()] || 0;
      const isBusy = activeOrdersCount > 0;

      return {
        _id: rider._id,
        name: rider.name,
        mobile: rider.mobile,
        email: rider.email,
        vehicleNumber: rider.vehicleNumber || "",
        vehicleType: rider.vehicleType || "Bike",
        profileImage: rider.profileImage || "",
        isOnline: rider.isOnline,
        available: rider.available,
        status: rider.status,
        distanceKm,
        isBusy,
        activeOrdersCount,
      };
    });

    // Sort: Available non-busy riders first, then by distance ascending
    formattedRiders.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      success: true,
      message: "Available delivery partners fetched successfully",
      data: formattedRiders,
    });
  },
);

/**
 * Assign delivery boy by seller (Manual Seller Assignment)
 */
export const assignDeliveryBoySeller = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.userId;
    const { id } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: "Delivery partner ID is required",
      });
    }

    // Verify order exists and seller has items in it
    const order = await findOrderByIdOrNumber(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const sellerItems = await OrderItem.findOne({ order: order._id, seller: sellerId });
    if (!sellerItems) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to assign delivery for this order",
      });
    }

    // Channel guard: Local delivery assignment is only applicable for Quick Commerce orders
    if (order.orderType === "ECOMMERCE") {
      return res.status(400).json({
        success: false,
        message: "Local delivery assignment is only applicable for Quick Commerce orders. Ecommerce orders are fulfilled via courier shipping.",
      });
    }

    // Check if seller is ECOMMERCE only
    const Seller = (await import("../../../models/Seller")).default;
    const seller = await Seller.findById(sellerId).select("vendorType");
    if (seller?.vendorType === "ECOMMERCE") {
      return res.status(400).json({
        success: false,
        message: "ECOMMERCE-only vendors cannot assign local delivery partners. Use courier shipping.",
      });
    }

    // In a MIXED or multi-group order, verify order has a LOCAL_DELIVERY fulfillment group
    if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
      const qcGroup = order.fulfillmentGroups.find(
        (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
      );
      if (!qcGroup) {
        return res.status(400).json({
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
        });
      }

      // Verify seller owns items in the QC group
      const sellerHasQcItem = await OrderItem.exists({
        order: order._id,
        seller: sellerId,
        _id: { $in: qcGroup.items },
      });
      if (!sellerHasQcItem) {
        return res.status(400).json({
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
        });
      }
    }

    if (["Delivered", "Cancelled", "Rejected", "Returned"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign delivery partner to order with status ${order.status}`,
      });
    }

    // Verify delivery boy exists and is active
    const Delivery = (await import("../../../models/Delivery")).default;
    const deliveryBoy = await Delivery.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    if (deliveryBoy.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Delivery partner is not active",
      });
    }

    // Check if order is already assigned to a different rider
    if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryBoyId.toString()) {
      return res.status(409).json({
        success: false,
        message: "Order is already assigned to another delivery partner",
      });
    }

    // Atomic update on order
    const nextStatus = (order.status === "Pending" || order.status === "Received" || order.status === "Accepted")
      ? "Processed"
      : order.status;

    // Update LOCAL_DELIVERY group with assigned rider while keeping COURIER_SHIPPING groups untouched
    const updatedFulfillmentGroups = (order.fulfillmentGroups || []).map((fg: any) => {
      const fgObj = fg.toObject ? fg.toObject() : { ...fg };
      if (fgObj.fulfillmentType === "LOCAL_DELIVERY") {
        return {
          ...fgObj,
          deliveryBoy: deliveryBoyId,
          status: fgObj.status === "Pending" ? "Processing" : fgObj.status,
        };
      }
      return fgObj;
    });

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        $or: [
          { deliveryBoy: null },
          { deliveryBoy: { $exists: false } },
          { deliveryBoy: deliveryBoyId },
        ],
        status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
      },
      {
        $set: {
          deliveryBoy: deliveryBoyId,
          deliveryBoyStatus: "Assigned",
          assignedAt: new Date(),
          deliveryPreference: "Self",
          deliveryAssignmentStatus: "Assigned",
          deliveryAssignmentResolvedAt: new Date(),
          status: nextStatus,
          fulfillmentGroups: updatedFulfillmentGroups,
        },
      },
      { new: true },
    )
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email vehicleNumber vehicleType")
      .populate("fulfillmentGroups.deliveryBoy", "name mobile email vehicleNumber vehicleType")
      .populate("items");

    if (!updatedOrder) {
      const currentOrder = await Order.findById(order._id);
      if (currentOrder?.deliveryBoy && currentOrder.deliveryBoy.toString() !== deliveryBoyId.toString()) {
        return res.status(409).json({
          success: false,
          message: "Order was already assigned to another delivery partner",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Failed to assign delivery partner",
      });
    }

    // Create or update delivery assignment record
    const DeliveryAssignment = (await import("../../../models/DeliveryAssignment")).default;
    await DeliveryAssignment.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        deliveryBoy: deliveryBoyId,
        assignedAt: new Date(),
        assignedBy: sellerId,
        status: "Assigned",
      },
      { upsert: true, new: true },
    );

    // Trigger notification to delivery boy & broadcast order update
    const io: SocketIOServer = req.app.get("io");
    if (io) {
      const { notifyDeliveryBoyOfAssignment } = await import(
        "../../../services/orderNotificationService"
      );
      notifyDeliveryBoyOfAssignment(io, updatedOrder, deliveryBoyId);

      io.to(`order-${order._id}`).emit("order-updated", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        deliveryBoy: deliveryBoyId,
        deliveryBoyName: deliveryBoy.name,
        deliveryBoyPhone: deliveryBoy.mobile,
        status: updatedOrder.status,
        deliveryBoyStatus: "Assigned",
        deliveryAssignmentStatus: "Assigned",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery partner assigned successfully",
      data: updatedOrder,
    });
  },
);


