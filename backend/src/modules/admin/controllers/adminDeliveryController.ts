import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Delivery from "../../../models/Delivery";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import CashCollection from "../../../models/CashCollection";

/**
 * Create a new delivery boy
 */
export const createDeliveryBoy = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      mobile,
      email,
      password,
      dateOfBirth,
      address,
      city,
      pincode,
      drivingLicense,
      nationalIdentityCard,
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      bonusType,
    } = req.body;

    if (!name || !mobile || !email || !password || !address || !city) {
      return res.status(400).json({
        success: false,
        message:
          "Name, mobile, email, password, address, and city are required",
      });
    }

    const deliveryBoy = await Delivery.create({
      name,
      mobile,
      email,
      password,
      dateOfBirth,
      address,
      city,
      pincode,
      drivingLicense,
      nationalIdentityCard,
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      bonusType,
      status: "Inactive", // New delivery boys start as inactive
    });

    return res.status(201).json({
      success: true,
      message: "Delivery boy created successfully",
      data: deliveryBoy,
    });
  }
);

/**
 * Get all delivery boys
 */
export const getAllDeliveryBoys = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      available,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    if (status) query.status = status;
    if (available) query.available = available;
    if (req.query.isOnline !== undefined) {
      query.isOnline = req.query.isOnline === "true";
    }
    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: "i" } },
        { mobile: { $regex: search as string, $options: "i" } },
        { email: { $regex: search as string, $options: "i" } },
        { address: { $regex: search as string, $options: "i" } },
      ];
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [deliveryBoys, total] = await Promise.all([
      Delivery.find(query)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Delivery.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Delivery boys fetched successfully",
      data: deliveryBoys,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get delivery boy by ID
 */
export const getDeliveryBoyById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const deliveryBoy = await Delivery.findById(id).select("-password");

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy fetched successfully",
      data: deliveryBoy,
    });
  }
);

/**
 * Update delivery boy
 */
export const updateDeliveryBoy = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow password update through this endpoint
    delete updateData.password;

    const deliveryBoy = await Delivery.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy updated successfully",
      data: deliveryBoy,
    });
  }
);

/**
 * Delete delivery boy
 */
export const deleteDeliveryBoy = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check for active assignments
    const activeAssignments = await DeliveryAssignment.countDocuments({
      deliveryBoy: id,
      status: { $in: ["Assigned", "Picked Up", "In Transit"] },
    });

    if (activeAssignments > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete delivery boy with active assignments",
      });
    }

    // Check if cash balance exists
    const deliveryBoy = await Delivery.findById(id);
    if (deliveryBoy && (deliveryBoy.balance > 0 || deliveryBoy.cashCollected > 0)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete delivery boy with pending balance or cash collected",
      });
    }

    const deletedDeliveryBoy = await Delivery.findByIdAndDelete(id);

    if (!deletedDeliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy deleted successfully",
    });
  }
);

/**
 * Update delivery boy status
 */
export const updateDeliveryStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Inactive",
      });
    }

    const deliveryBoy = await Delivery.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).select("-password");

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    // Trigger push notification and in-app alert to delivery partner asynchronously
    import("../../../services/notificationService").then(({ sendDeliveryApprovalNotification }) => {
      sendDeliveryApprovalNotification(id, status as "Active" | "Inactive").catch((err: any) => {
        console.error(`❌ [Push Notification Error] Failed to send approval notification to delivery partner ${id}:`, err?.message);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Delivery boy status updated successfully",
      data: deliveryBoy,
    });
  }
);

/**
 * Update delivery boy availability
 */
export const updateDeliveryBoyAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { available } = req.body; // Expecting "Available" or "Not Available"

    if (!["Available", "Not Available"].includes(available)) {
      return res.status(400).json({
        success: false,
        message: "Availability must be 'Available' or 'Not Available'",
      });
    }

    const deliveryBoy = await Delivery.findByIdAndUpdate(
      id,
      { available },
      { new: true, runValidators: true }
    ).select("-password");

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    // Trigger push notification to delivery partner asynchronously
    import("../../../services/notificationService").then(({ sendNotification }) => {
      sendNotification(
        "Delivery",
        id,
        available === "Available" ? "🟢 Status: Available" : "🔴 Status: Not Available",
        available === "Available"
          ? "Admin has set your status to Available for receiving orders."
          : "Admin has set your status to Not Available for orders.",
        {
          type: available === "Available" ? "Success" : "Info",
          link: "/delivery",
          priority: "Medium",
        }
      ).catch((err: any) => {
        console.error(`❌ [Push Notification Error] Failed to send availability notification to delivery partner ${id}:`, err?.message);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Delivery boy availability updated successfully",
      data: deliveryBoy,
    });
  }
);

/**
 * Get delivery assignments
 */
export const getDeliveryAssignments = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params; // Delivery boy ID
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = { deliveryBoy: id };
    if (status) query.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [assignments, total] = await Promise.all([
      DeliveryAssignment.find(query)
        .populate("order")
        .populate("assignedBy", "firstName lastName")
        .sort({ assignedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      DeliveryAssignment.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Delivery assignments fetched successfully",
      data: assignments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Collect cash from delivery boy
 */
export const collectCash = asyncHandler(async (_req: Request, res: Response) => {
  // RETIRED (money bug): this legacy endpoint reduced `cashCollected` but ADDED the cash to the
  // rider's withdrawable `balance`, left `pendingAdminPayout` (the COD debt) unchanged, wrote no
  // ledger entry and never settled sellers. The admin UI uses POST /admin/cash-collections,
  // which reduces the debt, updates PlatformWallet and runs processPendingCODPayouts.
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is retired. Record rider cash via POST /admin/cash-collections (deliveryBoyId, orderId, amount).",
  });
});

/**
 * Get delivery boy cash collections
 */
export const getDeliveryBoyCashCollections = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [collections, total] = await Promise.all([
      CashCollection.find({ deliveryBoy: id })
        .sort({ collectedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      CashCollection.countDocuments({ deliveryBoy: id }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Cash collections fetched successfully",
      data: collections,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);
