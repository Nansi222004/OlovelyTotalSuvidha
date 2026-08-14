import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import FAQ from "../../../models/FAQ";

/**
 * Get all FAQs
 */
export const getFAQs = asyncHandler(async (req: Request, res: Response) => {
    const {
        page = 1,
        limit = 10,
        search = "",
        category,
        status,
        sortBy = "order",
        sortOrder = "asc",
    } = req.query;

    const query: any = {};

    // Search filter
    if (search) {
        query.$or = [
            { question: { $regex: search, $options: "i" } },
            { answer: { $regex: search, $options: "i" } },
        ];
    }

    // Category filter
    if (category) {
        query.category = category;
    }

    // Status filter
    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const [faqs, total] = await Promise.all([
        FAQ.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit as string)),
        FAQ.countDocuments(query),
    ]);

    return res.status(200).json({
        success: true,
        message: "FAQs fetched successfully",
        data: faqs,
        pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string)),
        },
    });
});

/**
 * Get FAQ by ID
 */
export const getFAQById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const faq = await FAQ.findById(id);

    if (!faq) {
        return res.status(404).json({
            success: false,
            message: "FAQ not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: "FAQ fetched successfully",
        data: faq,
    });
});

/**
 * Create a new FAQ
 */
export const createFAQ = asyncHandler(async (req: Request, res: Response) => {
    const { question, answer, category, order } = req.body;

    if (!question || !answer) {
        return res.status(400).json({
            success: false,
            message: "Question and answer are required",
        });
    }

    const faq = await FAQ.create({
        question,
        answer,
        category,
        order: order || 0,
    });

    return res.status(201).json({
        success: true,
        message: "FAQ created successfully",
        data: faq,
    });
});

/**
 * Update FAQ
 */
export const updateFAQ = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { question, answer, category, order, status } = req.body;

    const faq = await FAQ.findById(id);

    if (!faq) {
        return res.status(404).json({
            success: false,
            message: "FAQ not found",
        });
    }

    if (question !== undefined) faq.question = question;
    if (answer !== undefined) faq.answer = answer;
    if (category !== undefined) faq.category = category;
    if (order !== undefined) faq.order = order;
    if (status !== undefined) faq.status = status;

    await faq.save();

    return res.status(200).json({
        success: true,
        message: "FAQ updated successfully",
        data: faq,
    });
});

/**
 * Update FAQ status
 */
export const updateFAQStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["Active", "Inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Valid status is required (Active or Inactive)",
            });
        }

        const faq = await FAQ.findById(id);

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }

        faq.status = status;
        await faq.save();

        return res.status(200).json({
            success: true,
            message: "FAQ status updated successfully",
            data: faq,
        });
    }
);

/**
 * Delete FAQ
 */
export const deleteFAQ = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const faq = await FAQ.findById(id);

    if (!faq) {
        return res.status(404).json({
            success: false,
            message: "FAQ not found",
        });
    }

    await FAQ.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "FAQ deleted successfully",
    });
});

/**
 * Update FAQ order
 */
export const updateFAQOrder = asyncHandler(
    async (req: Request, res: Response) => {
        const { faqs } = req.body; // Array of { id, order }

        if (!Array.isArray(faqs)) {
            return res.status(400).json({
                success: false,
                message: "FAQs array is required",
            });
        }

        // Update each FAQ's order
        const updatePromises = faqs.map((item: { id: string; order: number }) =>
            FAQ.findByIdAndUpdate(item.id, { order: item.order }, { new: true })
        );

        await Promise.all(updatePromises);

        return res.status(200).json({
            success: true,
            message: "FAQ order updated successfully",
        });
    }
);
