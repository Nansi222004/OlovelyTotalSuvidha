/**
 * seller/returnController.ts
 *
 * Seller return management with:
 * - AUTHORIZATION: Seller can only view/act on returns for THEIR order items
 * - STATE MACHINE: Seller can only transition Pending→Approved/Rejected and confirm Handed To Seller→Completed
 * - SETTLEMENT: Financial settlement triggered ONLY on seller's confirmSellerReceipt (→ Completed)
 */

import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Return from "../../../models/Return";
import OrderItem from "../../../models/OrderItem";
import Order from "../../../models/Order";


/**
 * Helper: verify the return's orderItem belongs to the authenticated seller.
 * Returns the orderItem if valid, throws a 403 error if not.
 */
async function assertReturnBelongsToSeller(
  returnId: string,
  sellerId: string
): Promise<any> {
  const returnReq = await Return.findById(returnId).populate("orderItem");
  if (!returnReq) {
    throw Object.assign(new Error("Return request not found"), { statusCode: 404 });
  }

  const orderItem = returnReq.orderItem as any;
  if (!orderItem || orderItem.seller?.toString() !== sellerId) {
    throw Object.assign(
      new Error("You are not authorized to manage this return. It does not belong to your store."),
      { statusCode: 403 }
    );
  }

  return { returnReq, orderItem };
}

/**
 * GET /returns
 * Seller's return requests — filtered to ONLY their own order items.
 */
export const getReturnRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.userId;
    const { status, page = 1, limit = 10 } = req.query;

    // Find this seller's OrderItem IDs
    const sellerOrderItems = await OrderItem.find({ seller: sellerId }).select("_id");
    const sellerOrderItemIds = sellerOrderItems.map((item) => item._id);

    const query: any = { orderItem: { $in: sellerOrderItemIds } };
    if (status && status !== "All Status") {
      query.status = status;
    }

    const returns = await Return.find(query)
      .populate({ path: "orderItem", select: "productName productImage quantity unitPrice total sku" })
      .populate({ path: "order", select: "orderNumber customerName" })
      .populate("customer", "name email mobile")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Return.countDocuments(query);

    const formattedReturns = returns.map((ret) => {
      const item = ret.orderItem as any;
      const order = ret.order as any;
      const price = Number(item?.unitPrice || 0);
      const quantity = Number(ret.quantity || item?.quantity || 1);
      const totalAmount = Number(item?.total || price * quantity || 0);

      return {
        id: ret._id,
        orderItemId: item?._id?.toString() || ret._id?.toString(),
        product: item?.productName || "Unknown Product",
        productName: item?.productName || "Unknown Product",
        variant: item?.sku || "Standard",
        price,
        discPrice: price,
        quantity,
        total: totalAmount,
        customerName: order?.customerName || (ret.customer as any)?.name || "Unknown Customer",
        orderId: order?.orderNumber || "Unknown Order",
        amount: totalAmount,
        status: ret.status,
        date: ret.createdAt,
        returnReason: ret.reason,
        image: item?.productImage,
        lifecycleStage: (() => {
          const stages: Record<string, number> = {
            Pending: 1, Approved: 2, "Pickup Pending": 3,
            "Delivery Partner Assigned": 4, "Picked Up": 5, "In Transit": 6,
            "Handed To Seller": 7, Completed: 8, Rejected: 0,
          };
          return stages[ret.status] || 1;
        })(),
      };
    });


    return res.status(200).json({
      success: true,
      data: formattedReturns,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  }
);

/**
 * GET /returns/:id
 * Return detail — seller must own the item.
 */
export const getReturnRequestById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const sellerId = (req as any).user?.userId;

    let returnReq: any;
    let orderItem: any;

    try {
      const result = await assertReturnBelongsToSeller(id, sellerId!);
      returnReq = result.returnReq;
      orderItem = result.orderItem;
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    const order = returnReq.order as any;
    const fullReturn = await Return.findById(id)
      .populate({ path: "orderItem", select: "productName productImage quantity unitPrice total sku" })
      .populate({ path: "order", select: "orderNumber customerName deliveryAddress paymentMethod" })
      .populate("customer", "name email mobile")
      .populate("deliveryBoy", "name mobile");

    if (!fullReturn) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    const item = fullReturn.orderItem as any;
    const orderDoc = fullReturn.order as any;

    const { getReturnLifecycleSummary } = await import("../../../services/returnLifecycleService");
    const lifecycle = getReturnLifecycleSummary(fullReturn.status as any);

    const formattedDetail = {
      id: fullReturn._id,
      orderId: orderDoc?.orderNumber,
      status: fullReturn.status,
      lifecycle,
      customerName: orderDoc?.customerName,
      customerEmail: (fullReturn.customer as any)?.email,
      customerPhone: (fullReturn.customer as any)?.mobile,
      shippingAddress: orderDoc?.deliveryAddress
        ? `${orderDoc.deliveryAddress.address}, ${orderDoc.deliveryAddress.city}, ${orderDoc.deliveryAddress.pincode}`
        : "N/A",
      paymentMethod: orderDoc?.paymentMethod,
      deliveryPartner: fullReturn.deliveryBoy
        ? {
            name: (fullReturn.deliveryBoy as any)?.name,
            mobile: (fullReturn.deliveryBoy as any)?.mobile,
          }
        : null,
      items: [
        {
          id: item?._id,
          name: item?.productName,
          sku: item?.sku || "N/A",
          price: item?.unitPrice || 0,
          quantity: fullReturn.quantity,
          total: (item?.unitPrice || 0) * fullReturn.quantity,
          image: item?.productImage,
        },
      ],
      subtotal: (item?.unitPrice || 0) * fullReturn.quantity,
      total: (item?.unitPrice || 0) * fullReturn.quantity,
      reason: fullReturn.reason,
      reasonDescription: fullReturn.description,
      // Lifecycle timestamps
      approvedAt: fullReturn.approvedAt,
      pickedUpAt: fullReturn.pickedUpAt,
      inTransitAt: fullReturn.inTransitAt,
      handedToSellerAt: fullReturn.handedToSellerAt,
      completedAt: fullReturn.completedAt,
    };

    return res.status(200).json({ success: true, data: formattedDetail });
  }
);

/**
 * PATCH /returns/:id/status
 * Seller can ONLY approve or reject a Pending return.
 * Transitions enforced: Pending → Approved | Rejected
 * On Approved: status atomically becomes "Pickup Pending" (admin then assigns DP).
 *
 * NO financial settlement is triggered here.
 */
export const updateReturnStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = (req as any).user?.userId;

    // Seller can only set these statuses
    const sellerAllowedStatuses = ["Approved", "Rejected"];
    if (!sellerAllowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Sellers can only set return status to: ${sellerAllowedStatuses.join(", ")}`,
      });
    }

    // Authorization: verify return belongs to this seller
    let returnReq: any;
    try {
      const result = await assertReturnBelongsToSeller(id, sellerId!);
      returnReq = result.returnReq;
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    // State machine: seller can only act from "Pending"
    try {
      const { validateSellerReturnTransition } = await import("../../../services/returnLifecycleService");
      validateSellerReturnTransition(returnReq.status as any, status as any);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const updateData: any = {
      processedBy: sellerId,
      processedAt: new Date(),
    };

    if (status === "Approved") {
      // Atomic: Pending → Approved → Pickup Pending (never leaves a return stuck at Approved)
      updateData.status = "Pickup Pending";
      updateData.approvedAt = new Date();
    } else {
      updateData.status = "Rejected";
      const rejectionReason = req.body.reason || req.body.rejectionReason;
      if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
        return res.status(400).json({
          success: false,
          message: "A reason is required when rejecting a return request.",
        });
      }
      updateData.rejectionReason = rejectionReason.trim();
    }

    const updatedReturn = await Return.findByIdAndUpdate(id, updateData, { new: true });

    // Send customer notification via notificationService
    try {
      const { sendReturnStatusNotificationToCustomer } = await import("../../../services/notificationService");
      const order = await Order.findById(returnReq.order);
      const item = await OrderItem.findById(returnReq.orderItem);
      const productName = item?.productName || "Product";
      const orderNum = order?.orderNumber || "Order";
      const io = req.app.get("io");

      await sendReturnStatusNotificationToCustomer(
        returnReq.customer.toString(),
        orderNum,
        productName,
        status,
        updateData.rejectionReason,
        returnReq.order.toString(),
        io
      );
    } catch (notifErr) {
      console.error("Error sending customer return notification:", notifErr);
    }

    // NO financial settlement here — ONLY triggered after seller confirms physical receipt.

    return res.status(200).json({
      success: true,
      message:
        status === "Approved"
          ? "Return approved. Now awaiting delivery partner assignment for pickup."
          : "Return rejected successfully.",
      data: updatedReturn,
    });
  }
);


/**
 * POST /returns/:id/confirm-receipt
 *
 * Seller confirms they physically received the returned item from the delivery partner.
 * This is the FINAL physical step that advances the lifecycle to "Completed" and
 * TRIGGERS FINANCIAL SETTLEMENT:
 *   - Customer receives refund (product price only)
 *   - Seller's onHoldBalance / balance is reversed by net product earning
 *   - Commission record marked Cancelled
 *   - Refund document created
 *
 * Transition: "Handed To Seller" → "Completed" → executeReturnRefundAndReversal()
 */
export const confirmSellerReceipt = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const sellerId = (req as any).user?.userId;

    // Authorization
    let returnReq: any;
    try {
      const result = await assertReturnBelongsToSeller(id, sellerId!);
      returnReq = result.returnReq;
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    // Idempotency: if already Completed with settlement done, return success
    if (
      returnReq.status === "Completed" &&
      returnReq.financialSettlementStatus === "Completed"
    ) {
      return res.status(200).json({
        success: true,
        message: "Return is already completed and settled (idempotent).",
        data: returnReq,
      });
    }

    // State machine check: must be in "Handed To Seller"
    if (returnReq.status !== "Handed To Seller") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt — return is in "${returnReq.status}" status. Delivery partner must first hand the item to you.`,
      });
    }

    // *** TRIGGER FINANCIAL SETTLEMENT & COMPLETE RETURN ATOMICALLY ***
    // This is the ONLY place settlement is triggered in the return lifecycle.
    let settlementResult: any = null;
    try {
      const { triggerReturnFinancialSettlement } = await import(
        "../../../services/returnLifecycleService"
      );
      settlementResult = await triggerReturnFinancialSettlement(id, sellerId);

      if (!settlementResult.success) {
        return res.status(500).json({
          success: false,
          message: `Return receipt confirmation failed: ${settlementResult.message}`,
        });
      }
    } catch (settleErr: any) {
      return res.status(500).json({
        success: false,
        message: `Return receipt confirmation error: ${settleErr.message}`,
      });
    }


    const finalReturn = await Return.findById(id)
      .populate("order", "orderNumber")
      .populate("customer", "name email");

    // Send customer notification that return is completed and refund is credited
    try {
      const { sendReturnStatusNotificationToCustomer } = await import("../../../services/notificationService");
      const order = await Order.findById(returnReq.order);
      const item = await OrderItem.findById(returnReq.orderItem);
      const productName = item?.productName || "Product";
      const orderNum = order?.orderNumber || "Order";
      const io = req.app.get("io");

      await sendReturnStatusNotificationToCustomer(
        returnReq.customer.toString(),
        orderNum,
        productName,
        "Completed",
        undefined,
        returnReq.order.toString(),
        io
      );
    } catch (notifErr) {
      console.error("Error sending customer completion notification:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Return completed. Financial settlement executed — customer refund issued.",
      data: {
        return: finalReturn,
        settlement: settlementResult?.data,
      },
    });

  }
);
