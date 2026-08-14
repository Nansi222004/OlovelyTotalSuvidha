import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import PaymentMethod from "../../../models/PaymentMethod";

/**
 * Get all payment methods
 */
export const getPaymentMethods = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = req.query;

        const query: any = {
            // Only show COD and Razorpay payment methods
            $or: [
                { type: "COD" },
                { provider: { $regex: /razorpay/i } },
                { name: { $regex: /razorpay/i } }
            ]
        };
        if (status) {
            query.isActive = status === "Active";
        }

        const paymentMethods = await PaymentMethod.find(query).sort({ order: 1 });

        // Transform to match frontend expectation
        const transformedMethods = paymentMethods.map((pm: any) => ({
            _id: pm._id,
            name: pm.name,
            description: pm.description,
            status: pm.isActive ? "Active" : "InActive",
            // For now, assume if type is Online/Card etc, it might have keys. 
            // But we added fields to model, so we can check if they exist in DB (even if hidden here)
            // Since select: false, we won't see them. 
            // But we can check type.
            hasApiKeys: ["Online", "Card", "Net Banking", "UPI", "Wallet"].includes(pm.type),
            provider: pm.provider,
            type: pm.type === "COD" ? "cod" : "gateway",
        }));

        return res.status(200).json({
            success: true,
            message: "Payment methods fetched successfully",
            data: transformedMethods,
        });
    }
);

/**
 * Get payment method by ID
 */
export const getPaymentMethodById = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        // We explicitly select keys to return them if needed for editing (though usually we mask them)
        // The frontend seems to want to edit them, so we should return them if admin requests specific ID
        const paymentMethod = await PaymentMethod.findById(id).select("+apiKey +secretKey");

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: "Payment method not found",
            });
        }

        const transformedMethod = {
            _id: paymentMethod._id,
            name: paymentMethod.name,
            description: paymentMethod.description,
            status: paymentMethod.isActive ? "Active" : "InActive",
            hasApiKeys: !!paymentMethod.apiKey,
            apiKey: paymentMethod.apiKey,
            secretKey: paymentMethod.secretKey,
            provider: paymentMethod.provider,
            type: paymentMethod.type === "COD" ? "cod" : "gateway",
        };

        return res.status(200).json({
            success: true,
            message: "Payment method details fetched successfully",
            data: transformedMethod,
        });
    }
);

/**
 * Update payment method
 */
export const updatePaymentMethod = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { description, status, apiKey, secretKey, provider } = req.body;

        const paymentMethod = await PaymentMethod.findById(id);

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: "Payment method not found",
            });
        }

        if (description) paymentMethod.description = description;
        if (status) paymentMethod.isActive = status === "Active";
        if (apiKey) paymentMethod.apiKey = apiKey;
        if (secretKey) paymentMethod.secretKey = secretKey;
        if (provider) paymentMethod.provider = provider;

        await paymentMethod.save();

        return res.status(200).json({
            success: true,
            message: "Payment method updated successfully",
            data: {
                _id: paymentMethod._id,
                name: paymentMethod.name,
                status: paymentMethod.isActive ? "Active" : "InActive"
            },
        });
    }
);

/**
 * Update payment method status
 */
export const updatePaymentMethodStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        const paymentMethod = await PaymentMethod.findByIdAndUpdate(
            id,
            { isActive: status === "Active" },
            { new: true }
        );

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: "Payment method not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Payment method ${status === "Active" ? "activated" : "deactivated"} successfully`,
            data: {
                _id: paymentMethod._id,
                status: paymentMethod.isActive ? "Active" : "InActive"
            },
        });
    }
);
