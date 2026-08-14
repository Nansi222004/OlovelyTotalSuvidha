import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Policy from "../../../models/Policy";

/**
 * Create a new policy
 */
export const createPolicy = asyncHandler(async (req: Request, res: Response) => {
    const { type, title, content, version, isActive } = req.body;

    if (!type || !title || !content || !version) {
        return res.status(400).json({
            success: false,
            message: "Type, title, content, and version are required",
        });
    }

    const policy = await Policy.create({
        type,
        title,
        content,
        version,
        isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({
        success: true,
        message: "Policy created successfully",
        data: policy,
    });
});

/**
 * Get all policies
 */
export const getPolicies = asyncHandler(async (req: Request, res: Response) => {
    const { type, isActive, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (search) {
        query.$or = [
            { title: { $regex: search as string, $options: "i" } },
            { content: { $regex: search as string, $options: "i" } },
            { version: { $regex: search as string, $options: "i" } },
        ];
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const policies = await Policy.find(query).sort(sort);

    return res.status(200).json({
        success: true,
        message: "Policies fetched successfully",
        data: policies,
    });
});

/**
 * Update policy
 */
export const updatePolicy = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const policy = await Policy.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    if (!policy) {
        return res.status(404).json({
            success: false,
            message: "Policy not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: "Policy updated successfully",
        data: policy,
    });
});

/**
 * Delete policy
 */
export const deletePolicy = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const policy = await Policy.findByIdAndDelete(id);

    if (!policy) {
        return res.status(404).json({
            success: false,
            message: "Policy not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: "Policy deleted successfully",
    });
});
