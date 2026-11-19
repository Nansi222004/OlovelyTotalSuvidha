import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import FAQ, { FAQ_AUDIENCES } from "../../../models/FAQ";

const isAudience = (value: unknown): value is (typeof FAQ_AUDIENCES)[number] =>
    typeof value === "string" && (FAQ_AUDIENCES as readonly string[]).includes(value);

/** Accepts only { [languageCode]: { [field]: text } } so arbitrary data is never stored. */
const sanitizeTranslations = (value: unknown): Record<string, Record<string, string>> | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const clean: Record<string, Record<string, string>> = {};
    for (const [lang, fields] of Object.entries(value as Record<string, unknown>)) {
        if (!/^[a-z]{2,3}$/.test(lang) || !fields || typeof fields !== "object") continue;
        const entry: Record<string, string> = {};
        for (const key of ["question", "answer"]) {
            const text = (fields as Record<string, unknown>)[key];
            if (typeof text === "string") entry[key] = text.trim();
        }
        clean[lang] = entry;
    }
    return clean;
};

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
        audience,
        sortBy = "order",
        sortOrder = "asc",
    } = req.query;

    const query: any = {};

    // Audience filter (old FAQs without an audience belong to customers)
    if (audience !== undefined) {
        if (!isAudience(audience)) {
            return res.status(400).json({ success: false, message: "audience must be customer, seller or delivery" });
        }
        query.audience = audience === "customer" ? { $in: ["customer", null] } : audience;
    }

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
    const { question, answer, category, order, audience = "customer", translations } = req.body;

    if (!question || typeof question !== "string" || !question.trim() || !answer || typeof answer !== "string" || !answer.trim()) {
        return res.status(400).json({
            success: false,
            message: "Question and answer are required",
        });
    }
    if (!isAudience(audience)) {
        return res.status(400).json({ success: false, message: "audience must be customer, seller or delivery" });
    }

    const faq = await FAQ.create({
        question,
        answer,
        category,
        audience,
        order: order || 0,
        ...(sanitizeTranslations(translations) ? { translations: sanitizeTranslations(translations) } : {}),
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
    const { question, answer, category, order, status, audience, translations } = req.body;

    if (audience !== undefined && !isAudience(audience)) {
        return res.status(400).json({ success: false, message: "audience must be customer, seller or delivery" });
    }

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
    if (audience !== undefined) faq.audience = audience;
    const cleanTranslations = sanitizeTranslations(translations);
    if (cleanTranslations) {
        faq.translations = cleanTranslations;
        faq.markModified("translations");
    }

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
