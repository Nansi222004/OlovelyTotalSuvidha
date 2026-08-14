import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import CashCollection from "../../../models/CashCollection";
import Delivery from "../../../models/Delivery";
import Order from "../../../models/Order";
import { processPendingCODPayouts } from "../../../services/commissionService";
import PlatformWallet from "../../../models/PlatformWallet";

/**
 * Get all cash collections
 */
export const getCashCollections = asyncHandler(
    async (req: Request, res: Response) => {
        const {
            page = 1,
            limit = 10,
            deliveryBoyId,
            fromDate,
            toDate,
            status,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const query: any = {};

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by delivery boy
        if (deliveryBoyId) {
            query.deliveryBoy = deliveryBoyId;
        }

        // Date range filter
        if (fromDate || toDate) {
            query.collectedAt = {};
            if (fromDate) {
                query.collectedAt.$gte = new Date(fromDate as string);
            }
            if (toDate) {
                query.collectedAt.$lte = new Date(toDate as string);
            }
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

        const [collections, total] = await Promise.all([
            CashCollection.find(query)
                .populate("deliveryBoy", "name mobile")
                .populate("order", "orderNumber total")
                .populate("collectedBy", "name")
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit as string)),
            CashCollection.countDocuments(query),
        ]);

        // Transform data to match frontend expectations
        const transformedCollections = collections.map((collection: any) => ({
            _id: collection._id,
            deliveryBoyId: collection.deliveryBoy?._id,
            deliveryBoyName: collection.deliveryBoy?.name || "Unknown",
            orderId: collection.order?._id,
            orderNumber: collection.order?.orderNumber || "Unknown",
            total: collection.order?.total || 0,
            amount: collection.amount,
            remark: collection.remark,
            status: collection.status,
            collectedAt: collection.collectedAt,
            collectedBy: collection.collectedBy?.name || "Unknown",
        }));

        return res.status(200).json({
            success: true,
            message: "Cash collections fetched successfully",
            data: transformedCollections,
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
 * Get cash collection by ID
 */
export const getCashCollectionById = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const collection = await CashCollection.findById(id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cash collection fetched successfully",
            data: collection,
        });
    }
);

/**
 * Create cash collection (Manual Entry)
 */
export const createCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { deliveryBoyId, orderId, amount, remark } = req.body;

        if (!deliveryBoyId || !orderId || !amount) {
            return res.status(400).json({
                success: false,
                message: "Delivery boy ID, order ID, and amount are required",
            });
        }

        // Verify delivery boy exists
        const deliveryBoy = await Delivery.findById(deliveryBoyId);
        if (!deliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "Delivery boy not found",
            });
        }

        // Verify order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Create cash collection
        const collection = await CashCollection.create({
            deliveryBoy: deliveryBoyId,
            order: orderId,
            amount,
            remark,
            status: "Collected",
            collectedBy: req.user?.userId,
            collectedAt: new Date(),
        });

        // Update delivery boy's cash collected and debt
        deliveryBoy.cashCollected = (deliveryBoy.cashCollected || 0) - amount;
        deliveryBoy.pendingAdminPayout = Math.max(0, (deliveryBoy.pendingAdminPayout || 0) - amount);
        await deliveryBoy.save();

        // Update Platform Wallet
        const platformWallet = await PlatformWallet.getWallet();
        platformWallet.totalPlatformEarning += amount;
        platformWallet.currentPlatformBalance += amount;
        platformWallet.pendingFromDeliveryBoy = Math.max(0, platformWallet.pendingFromDeliveryBoy - amount);
        await platformWallet.save();

        // Distribute funds (Reconciliation)
        await processPendingCODPayouts(deliveryBoyId, amount);

        const populatedCollection = await CashCollection.findById(collection._id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        return res.status(201).json({
            success: true,
            message: "Cash collection created successfully",
            data: populatedCollection,
        });
    }
);

/**
 * Confirm a pending cash collection (Admin received cash)
 */
export const confirmCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const collection = await CashCollection.findById(id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        if (collection.status === "Collected") {
            return res.status(400).json({
                success: false,
                message: "Cash collection is already confirmed",
            });
        }

        // Update status and collection info
        collection.status = "Collected";
        collection.collectedBy = req.user?.userId as any;
        collection.collectedAt = new Date();
        await collection.save();

        // Update delivery boy's cash collected counter and pending debt
        const deliveryBoy = await Delivery.findById(collection.deliveryBoy);
        if (deliveryBoy) {
            // 1. Reduce physical cash counter
            deliveryBoy.cashCollected = Math.max(0, (deliveryBoy.cashCollected || 0) - collection.amount);

            // 2. Reduce the financial debt (pendingAdminPayout)
            const currentPending = deliveryBoy.pendingAdminPayout || 0;
            deliveryBoy.pendingAdminPayout = Math.max(0, currentPending - collection.amount);

            await deliveryBoy.save();

            // 3. Update Platform Wallet
            const platformWallet = await PlatformWallet.getWallet();
            platformWallet.totalPlatformEarning += collection.amount;
            platformWallet.currentPlatformBalance += collection.amount;
            platformWallet.pendingFromDeliveryBoy = Math.max(0, platformWallet.pendingFromDeliveryBoy - collection.amount);
            await platformWallet.save();

            // 4. Distribute funds to sellers (releases "Pending" commissions)
            await processPendingCODPayouts(deliveryBoy._id.toString(), collection.amount);

            // 5. Mark this order as COD paid to admin (so it leaves seller settlement "pending" list)
            await Order.findByIdAndUpdate(collection.order, { codPaidToAdminAt: new Date() });

            console.log(`[Cash Collection] Reconciled ₹${collection.amount} for DB ${deliveryBoy.name}. New pending debt: ₹${deliveryBoy.pendingAdminPayout}`);
        }

        const populatedCollection = await CashCollection.findById(id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        return res.status(200).json({
            success: true,
            message: "Cash collection confirmed successfully",
            data: populatedCollection,
        });
    }
);

/**
 * Update cash collection
 */
export const updateCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { amount, remark } = req.body;

        const collection = await CashCollection.findById(id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        // If amount is being updated, adjust delivery boy's cash collected (only if already collected)
        if (amount !== undefined && amount !== collection.amount && collection.status === "Collected") {
            const deliveryBoy = await Delivery.findById(collection.deliveryBoy);
            if (deliveryBoy) {
                const difference = collection.amount - amount; // If new amount is smaller, diff is positive (restore debt)
                deliveryBoy.cashCollected = (deliveryBoy.cashCollected || 0) + difference;
                deliveryBoy.pendingAdminPayout = Math.max(0, (deliveryBoy.pendingAdminPayout || 0) + difference);
                await deliveryBoy.save();

                // Sync Platform Wallet
                const platformWallet = await PlatformWallet.getWallet();
                platformWallet.totalPlatformEarning -= difference;
                platformWallet.currentPlatformBalance -= difference;
                platformWallet.pendingFromDeliveryBoy += difference;
                await platformWallet.save();
            }
            collection.amount = amount;
        } else if (amount !== undefined) {
            collection.amount = amount;
        }

        if (remark !== undefined) {
            collection.remark = remark;
        }

        await collection.save();

        const updatedCollection = await CashCollection.findById(id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        return res.status(200).json({
            success: true,
            message: "Cash collection updated successfully",
            data: updatedCollection,
        });
    }
);

/**
 * Delete cash collection
 */
export const deleteCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const collection = await CashCollection.findById(id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        // Restore the amount to delivery boy's cash collected and debt
        if (collection.status === "Collected") {
            const deliveryBoy = await Delivery.findById(collection.deliveryBoy);
            if (deliveryBoy) {
                deliveryBoy.cashCollected = (deliveryBoy.cashCollected || 0) + collection.amount;
                deliveryBoy.pendingAdminPayout = (deliveryBoy.pendingAdminPayout || 0) + collection.amount;
                await deliveryBoy.save();

                // Sync Platform Wallet
                const platformWallet = await PlatformWallet.getWallet();
                platformWallet.totalPlatformEarning -= collection.amount;
                platformWallet.currentPlatformBalance -= collection.amount;
                platformWallet.pendingFromDeliveryBoy += collection.amount;
                await platformWallet.save();
            }
        }

        await CashCollection.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Cash collection deleted successfully",
        });
    }
);
