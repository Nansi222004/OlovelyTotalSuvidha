
import { Request, Response } from 'express';
import Wishlist from '../../../models/Wishlist';
import Product from '../../../models/Product';
import { findSellersWithinRange } from '../../../utils/locationHelper';

export const getWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        let wishlist = await Wishlist.findOne({ customer: userId }).populate({
            path: 'products',
            match: {
                status: 'Active',
                publish: true,
            },
            populate: {
                path: 'seller',
                select: 'storeName location serviceRadiusKm viewCustomerDetails'
            }
        });

        if (!wishlist) {
            // Return empty if not created yet
            wishlist = new Wishlist({ customer: userId, products: [] });
        }

        return res.status(200).json({
            success: true,
            data: wishlist
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching wishlist',
            error: error.message
        });
    }
};

export const addToWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Verify product exists and is active
        const product = await Product.findOne({ _id: productId, status: 'Active', publish: true });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        let wishlist = await Wishlist.findOne({ customer: userId });

        if (!wishlist) {
            wishlist = await Wishlist.create({ customer: userId, products: [productId] });
        } else {
            // Add if not exists
            if (!wishlist.products.some(p => p.toString() === productId.toString())) {
                wishlist.products.push(productId);
                await wishlist.save();
            }
        }

        const populatedWishlist = await wishlist.populate({
            path: 'products',
            match: { status: 'Active', publish: true },
            populate: {
                path: 'seller',
                select: 'storeName location serviceRadiusKm viewCustomerDetails'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Added to wishlist',
            data: populatedWishlist
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding to wishlist',
            error: error.message
        });
    }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ customer: userId });

        if (wishlist) {
            wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
            await wishlist.save();
            await wishlist.populate('products');
        }

        return res.status(200).json({
            success: true,
            message: 'Removed from wishlist',
            data: wishlist
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error removing from wishlist',
            error: error.message
        });
    }
};
