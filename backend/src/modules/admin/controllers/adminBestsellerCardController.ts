import { Request, Response } from "express";
import BestsellerCard from "../../../models/BestsellerCard";
import mongoose from "mongoose";

const MAX_ACTIVE_CARDS = 6;

// Get all bestseller cards
export const getBestsellerCards = async (_req: Request, res: Response) => {
    try {
        const cards = await BestsellerCard.find()
            .populate("category", "name slug image")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: cards,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching bestseller cards",
            error: error.message,
        });
    }
};

// Get single bestseller card by ID
export const getBestsellerCardById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid card ID",
            });
        }

        const card = await BestsellerCard.findById(id)
            .populate("category", "name slug image")
            .lean();

        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Bestseller card not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: card,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching bestseller card",
            error: error.message,
        });
    }
};

// Create new bestseller card
export const createBestsellerCard = async (req: Request, res: Response) => {
    try {
        const { name, category, order, isActive } = req.body;

        // Validate required fields
        if (!name || !category) {
            return res.status(400).json({
                success: false,
                message: "Name and category are required",
            });
        }

        // Validate category ID
        if (!mongoose.Types.ObjectId.isValid(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID",
            });
        }

        // Check if trying to set as active and if we already have max active cards
        const willBeActive = isActive !== undefined ? isActive : true;
        if (willBeActive) {
            const activeCardsCount = await BestsellerCard.countDocuments({ isActive: true });
            if (activeCardsCount >= MAX_ACTIVE_CARDS) {
                return res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_ACTIVE_CARDS} active bestseller cards allowed`,
                });
            }
        }

        // If no order specified, set it to the end
        let cardOrder = order;
        if (cardOrder === undefined || cardOrder === null) {
            const maxOrderCard = await BestsellerCard.findOne().sort({ order: -1 }).lean();
            cardOrder = maxOrderCard ? maxOrderCard.order + 1 : 0;
        }

        const newCard = new BestsellerCard({
            name,
            category,
            order: cardOrder,
            isActive: willBeActive,
        });

        await newCard.save();

        const populatedCard = await BestsellerCard.findById(newCard._id)
            .populate("category", "name slug image")
            .lean();

        return res.status(201).json({
            success: true,
            message: "Bestseller card created successfully",
            data: populatedCard,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error creating bestseller card",
            error: error.message,
        });
    }
};

// Update bestseller card
export const updateBestsellerCard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, category, order, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid card ID",
            });
        }

        const card = await BestsellerCard.findById(id);
        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Bestseller card not found",
            });
        }

        // Validate category ID if provided
        if (category && !mongoose.Types.ObjectId.isValid(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID",
            });
        }

        // Check if trying to set as active and if we already have max active cards
        const willBeActive = isActive !== undefined ? isActive : card.isActive;
        if (willBeActive && !card.isActive) {
            // If switching from inactive to active
            const activeCardsCount = await BestsellerCard.countDocuments({ isActive: true });
            if (activeCardsCount >= MAX_ACTIVE_CARDS) {
                return res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_ACTIVE_CARDS} active bestseller cards allowed`,
                });
            }
        }

        // Update fields
        if (name !== undefined) card.name = name;
        if (category !== undefined) card.category = category;
        if (order !== undefined) card.order = order;
        if (isActive !== undefined) card.isActive = isActive;

        await card.save();

        const updatedCard = await BestsellerCard.findById(id)
            .populate("category", "name slug image")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Bestseller card updated successfully",
            data: updatedCard,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating bestseller card",
            error: error.message,
        });
    }
};

// Delete bestseller card
export const deleteBestsellerCard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid card ID",
            });
        }

        const card = await BestsellerCard.findByIdAndDelete(id);
        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Bestseller card not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Bestseller card deleted successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error deleting bestseller card",
            error: error.message,
        });
    }
};

// Reorder bestseller cards
export const reorderBestsellerCards = async (req: Request, res: Response) => {
    try {
        const { cards } = req.body; // Array of { id, order }

        if (!Array.isArray(cards)) {
            return res.status(400).json({
                success: false,
                message: "Cards must be an array",
            });
        }

        // Update order for each card
        const updatePromises = cards.map(({ id, order }: { id: string; order: number }) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid card ID: ${id}`);
            }
            return BestsellerCard.findByIdAndUpdate(id, { order }, { new: true });
        });

        await Promise.all(updatePromises);

        const updatedCards = await BestsellerCard.find()
            .populate("category", "name slug image")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Bestseller cards reordered successfully",
            data: updatedCards,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error reordering bestseller cards",
            error: error.message,
        });
    }
};

