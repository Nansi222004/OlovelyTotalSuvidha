import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import Seller from "../../../models/Seller";

/**
 * Admin view of every courier (Shiprocket) booking, one row per courier fulfillment group.
 *
 * Stage is derived from the SHIPMENT, not the order, so an order that was cancelled in the app
 * while its Shiprocket shipment is still live shows up under "Awaiting pickup" with a warning —
 * exactly the case that makes a courier turn up for a cancelled order.
 */
export type CourierShipmentStage =
  | "awaiting_pickup"
  | "in_transit"
  | "not_booked"
  | "delivered"
  | "rto"
  | "cancelled";

const STAGES: CourierShipmentStage[] = ["awaiting_pickup", "in_transit", "not_booked", "delivered", "rto", "cancelled"];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getCourierShipments = asyncHandler(async (req: Request, res: Response) => {
  const stage = String(req.query.stage || "awaiting_pickup");
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
  const search = String(req.query.search || "").trim();

  const pipeline: any[] = [
    {
      $match: {
        fulfillmentGroups: {
          $elemMatch: {
            fulfillmentType: { $in: ["COURIER_SHIPPING", "THIRD_PARTY_API"] },
            $or: [
              { "thirdPartyOrderDetails.externalOrderId": { $nin: [null, ""] } },
              { "shippingDetails.awbNumber": { $nin: [null, ""] } },
              { "thirdPartyOrderDetails.idempotencyKey": { $nin: [null, ""] } },
            ],
          },
        },
      },
    },
    { $unwind: "$fulfillmentGroups" },
    {
      $match: {
        "fulfillmentGroups.fulfillmentType": { $in: ["COURIER_SHIPPING", "THIRD_PARTY_API"] },
        $or: [
          { "fulfillmentGroups.thirdPartyOrderDetails.externalOrderId": { $nin: [null, ""] } },
          { "fulfillmentGroups.shippingDetails.awbNumber": { $nin: [null, ""] } },
          { "fulfillmentGroups.thirdPartyOrderDetails.idempotencyKey": { $nin: [null, ""] } },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        orderId: "$_id",
        orderNumber: 1,
        orderStatus: "$status",
        orderType: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        total: 1,
        customerName: 1,
        customerPhone: 1,
        createdAt: 1,
        groupId: "$fulfillmentGroups.groupId",
        groupStatus: "$fulfillmentGroups.status",
        seller: "$fulfillmentGroups.seller",
        groupTotal: "$fulfillmentGroups.subtotal",
        carrier: "$fulfillmentGroups.shippingDetails.carrier",
        awbNumber: "$fulfillmentGroups.shippingDetails.awbNumber",
        trackingUrl: "$fulfillmentGroups.shippingDetails.trackingUrl",
        shippedAt: "$fulfillmentGroups.shippingDetails.shippedAt",
        estimatedDelivery: "$fulfillmentGroups.shippingDetails.estimatedDelivery",
        externalOrderId: "$fulfillmentGroups.thirdPartyOrderDetails.externalOrderId",
        shipmentId: "$fulfillmentGroups.thirdPartyOrderDetails.shipmentId",
        carrierStatus: "$fulfillmentGroups.thirdPartyOrderDetails.status",
        lastError: "$fulfillmentGroups.thirdPartyOrderDetails.lastError",
        codAmount: "$fulfillmentGroups.thirdPartyOrderDetails.codAmount",
      },
    },
    {
      $addFields: {
        booked: { $gt: [{ $strLenCP: { $ifNull: ["$externalOrderId", ""] } }, 0] },
      },
    },
    {
      $addFields: {
        stage: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $eq: ["$groupStatus", "Cancelled"] },
                    { $eq: ["$carrierStatus", "Cancelled"] },
                    { $and: [{ $not: ["$booked"] }, { $in: ["$orderStatus", ["Cancelled", "Rejected"]] }] },
                  ],
                },
                then: "cancelled",
              },
              { case: { $eq: ["$carrierStatus", "Returned"] }, then: "rto" },
              {
                case: { $or: [{ $eq: ["$groupStatus", "Delivered"] }, { $eq: ["$carrierStatus", "Delivered"] }] },
                then: "delivered",
              },
              { case: { $not: ["$booked"] }, then: "not_booked" },
              {
                case: { $in: ["$carrierStatus", ["Picked Up", "In Transit", "Out for Delivery", "Action Required"]] },
                then: "in_transit",
              },
            ],
            default: "awaiting_pickup",
          },
        },
        // Order is closed in the app but the courier booking is still live at Shiprocket.
        orderClosedButShipmentLive: {
          $and: [
            "$booked",
            { $in: ["$orderStatus", ["Cancelled", "Rejected", "Returned"]] },
            { $ne: ["$groupStatus", "Cancelled"] },
            { $ne: ["$carrierStatus", "Cancelled"] },
            { $ne: ["$carrierStatus", "Delivered"] },
            { $ne: ["$carrierStatus", "Returned"] },
          ],
        },
      },
    },
  ];

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: { $or: [{ orderNumber: rx }, { awbNumber: rx }, { externalOrderId: rx }, { customerName: rx }] },
    });
  }

  const listMatch = stage === "all" || !STAGES.includes(stage as CourierShipmentStage) ? {} : { stage };

  pipeline.push({
    $facet: {
      counts: [{ $group: { _id: "$stage", count: { $sum: 1 } } }],
      warnings: [{ $match: { orderClosedButShipmentLive: true } }, { $count: "count" }],
      total: [{ $match: listMatch }, { $count: "count" }],
      rows: [
        { $match: listMatch },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
    },
  });

  const [result] = await Order.aggregate(pipeline);

  const counts: Record<string, number> = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const c of result?.counts || []) counts[c._id] = c.count;
  const total = result?.total?.[0]?.count || 0;

  const pageRows: any[] = result?.rows || [];
  const sellerIds = [...new Set(pageRows.map((r) => r.seller && String(r.seller)).filter(Boolean))];
  const sellers: any[] = sellerIds.length
    ? await Seller.find({ _id: { $in: sellerIds } })
        .select(
          "storeName sellerName isPlatform shippingConfig.pickupCity shippingConfig.pickupPincode shippingConfig.shiprocketPickupLocationName"
        )
        .lean()
    : [];
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));

  const rows = pageRows.map((r: any) => {
    const s = r.seller ? sellerById.get(String(r.seller)) : undefined;
    return {
      ...r,
      seller: s
        ? {
            _id: s._id,
            storeName: s.storeName || s.sellerName,
            isPlatform: !!s.isPlatform,
            pickupCity: s.shippingConfig?.pickupCity,
            pickupPincode: s.shippingConfig?.pickupPincode,
            pickupLocationName: s.shippingConfig?.shiprocketPickupLocationName,
          }
        : null,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      rows,
      counts,
      warnings: result?.warnings?.[0]?.count || 0,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});
