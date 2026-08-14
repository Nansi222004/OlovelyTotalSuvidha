import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Tax from "../../../models/Tax";

/**
 * Get all taxes
 */
export const getTaxes = asyncHandler(async (req: Request, res: Response) => {
    const {
        page = 1,
        limit = 10,
        search = "",
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Search filter
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    // Status filter
    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const [taxes, total] = await Promise.all([
        Tax.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit as string)),
        Tax.countDocuments(query),
    ]);

    return res.status(200).json({
        success: true,
        message: "Taxes fetched successfully",
        data: taxes,
        pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string)),
        },
    });
});

/**
 * Get tax by ID
 */
export const getTaxById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const tax = await Tax.findById(id);

    if (!tax) {
        return res.status(404).json({
            success: false,
            message: "Tax not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: "Tax fetched successfully",
        data: tax,
    });
});

/**
 * Create a new tax
 */
export const createTax = asyncHandler(async (req: Request, res: Response) => {
    const { name, percentage } = req.body;

    if (!name || percentage === undefined) {
        return res.status(400).json({
            success: false,
            message: "Name and percentage are required",
        });
    }

    // Check if tax with same name already exists
    const existingTax = await Tax.findOne({ name });
    if (existingTax) {
        return res.status(409).json({
            success: false,
            message: "Tax with this name already exists",
        });
    }

    const tax = await Tax.create({
        name,
        percentage,
    });

    return res.status(201).json({
        success: true,
        message: "Tax created successfully",
        data: tax,
    });
});

/**
 * Update tax
 */
export const updateTax = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, percentage, status } = req.body;

    const tax = await Tax.findById(id);

    if (!tax) {
        return res.status(404).json({
            success: false,
            message: "Tax not found",
        });
    }

    // Check if name is being changed and if it conflicts with another tax
    if (name && name !== tax.name) {
        const existingTax = await Tax.findOne({ name, _id: { $ne: id } });
        if (existingTax) {
            return res.status(409).json({
                success: false,
                message: "Tax with this name already exists",
            });
        }
        tax.name = name;
    }

    if (percentage !== undefined) {
        tax.percentage = percentage;
    }

    if (status) {
        tax.status = status;
    }

    await tax.save();

    return res.status(200).json({
        success: true,
        message: "Tax updated successfully",
        data: tax,
    });
});

/**
 * Update tax status
 */
export const updateTaxStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["Active", "Inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Valid status is required (Active or Inactive)",
            });
        }

        const tax = await Tax.findById(id);

        if (!tax) {
            return res.status(404).json({
                success: false,
                message: "Tax not found",
            });
        }

        tax.status = status;
        await tax.save();

        return res.status(200).json({
            success: true,
            message: "Tax status updated successfully",
            data: tax,
        });
    }
);

/**
 * Delete tax
 */
export const deleteTax = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const tax = await Tax.findById(id);

    if (!tax) {
        return res.status(404).json({
            success: false,
            message: "Tax not found",
        });
    }

    await Tax.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "Tax deleted successfully",
    });
});
