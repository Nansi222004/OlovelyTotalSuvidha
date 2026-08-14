import { Request, Response } from "express";
import LowestPricesProduct from "../../../models/LowestPricesProduct";
import Product from "../../../models/Product";
import mongoose from "mongoose";

// Get all lowest prices products
export const getLowestPricesProducts = async (_req: Request, res: Response) => {
    try {
        const products = await LowestPricesProduct.find()
            .populate("product", "productName mainImage price mrp discount status publish")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching lowest prices products",
            error: error.message,
        });
    }
};

// Get single lowest prices product by ID
export const getLowestPricesProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findById(id)
            .populate("product", "productName mainImage price mrp discount status publish")
            .lean();

        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: lowestPricesProduct,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching lowest prices product",
            error: error.message,
        });
    }
};

// Create new lowest prices product
export const createLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { product, order, isActive } = req.body;

        // Validate required fields
        if (!product) {
            return res.status(400).json({
                success: false,
                message: "Product is required",
            });
        }

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(product)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        // Check if product exists
        const productExists = await Product.findById(product);
        if (!productExists) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Check if product already exists in lowest prices
        const existing = await LowestPricesProduct.findOne({ product });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Product already exists in lowest prices section",
            });
        }

        // If no order specified, set it to the end
        let productOrder = order;
        if (productOrder === undefined || productOrder === null) {
            const maxOrderProduct = await LowestPricesProduct.findOne().sort({ order: -1 }).lean();
            productOrder = maxOrderProduct ? maxOrderProduct.order + 1 : 0;
        }

        const newLowestPricesProduct = new LowestPricesProduct({
            product,
            order: productOrder,
            isActive: isActive !== undefined ? isActive : true,
        });

        await newLowestPricesProduct.save();

        const populatedProduct = await LowestPricesProduct.findById(newLowestPricesProduct._id)
            .populate("product", "productName mainImage price mrp discount status publish")
            .lean();

        return res.status(201).json({
            success: true,
            message: "Product added to lowest prices section successfully",
            data: populatedProduct,
        });
    } catch (error: any) {
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Product already exists in lowest prices section",
            });
        }
        return res.status(500).json({
            success: false,
            message: "Error adding product to lowest prices section",
            error: error.message,
        });
    }
};

// Update lowest prices product
export const updateLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { order, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findById(id);
        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        // Update fields
        if (order !== undefined) lowestPricesProduct.order = order;
        if (isActive !== undefined) lowestPricesProduct.isActive = isActive;

        await lowestPricesProduct.save();

        const updatedProduct = await LowestPricesProduct.findById(id)
            .populate("product", "productName mainImage price mrp discount status publish")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lowest prices product updated successfully",
            data: updatedProduct,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating lowest prices product",
            error: error.message,
        });
    }
};

// Delete lowest prices product
export const deleteLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findByIdAndDelete(id);
        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from lowest prices section successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error removing product from lowest prices section",
            error: error.message,
        });
    }
};

// Reorder lowest prices products
export const reorderLowestPricesProducts = async (req: Request, res: Response) => {
    try {
        const { products } = req.body; // Array of { id, order }

        if (!Array.isArray(products)) {
            return res.status(400).json({
                success: false,
                message: "Products must be an array",
            });
        }

        // Update order for each product
        const updatePromises = products.map(({ id, order }: { id: string; order: number }) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid product ID: ${id}`);
            }
            return LowestPricesProduct.findByIdAndUpdate(id, { order }, { new: true });
        });

        await Promise.all(updatePromises);

        const updatedProducts = await LowestPricesProduct.find()
            .populate("product", "productName mainImage price mrp discount status publish")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lowest prices products reordered successfully",
            data: updatedProducts,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error reordering lowest prices products",
            error: error.message,
        });
    }
};

