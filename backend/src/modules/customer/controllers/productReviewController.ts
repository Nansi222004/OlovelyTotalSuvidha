import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../../../models/Review';
import Order from '../../../models/Order';
import OrderItem from '../../../models/OrderItem';
import Product from '../../../models/Product';

async function updateProductRatingAggregates(productId: string | mongoose.Types.ObjectId) {
    const productObjectId =
        typeof productId === 'string' ? new mongoose.Types.ObjectId(productId) : productId;

    const stats = await Review.aggregate([
        { $match: { product: productObjectId, status: 'Approved' } },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                count: { $sum: 1 },
            },
        },
    ]);

    const avgRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    const reviewsCount = stats.length > 0 ? stats[0].count : 0;

    await Product.findByIdAndUpdate(productObjectId, {
        rating: avgRating,
        reviewsCount,
    });

    return { avgRating, reviewsCount };
}

// Get reviews for a product (Public)
export const getProductReviews = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID',
            });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);

        const reviews = await Review.find({ product: productObjectId, status: 'Approved' })
            .populate('customer', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Review.countDocuments({ product: productObjectId, status: 'Approved' });

        const stats = await Review.aggregate([
            { $match: { product: productObjectId, status: 'Approved' } },
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]);

        const avgRating = stats.length > 0 ? stats[0].avgRating : 0;
        const totalReviews = stats.length > 0 ? stats[0].count : 0;

        return res.status(200).json({
            success: true,
            data: {
                reviews,
                stats: {
                    avgRating: Math.round(avgRating * 10) / 10,
                    totalReviews,
                },
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit) || 1,
                },
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message,
        });
    }
};

// Check if customer already reviewed a product for an order
export const getMyReviewForOrderProduct = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, orderId } = req.query;

        if (!productId || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'productId and orderId are required',
            });
        }

        const review = await Review.findOne({
            customer: userId,
            product: productId,
            order: orderId,
        }).select('_id rating comment title status createdAt');

        return res.status(200).json({
            success: true,
            data: review,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error checking review',
            error: error.message,
        });
    }
};

// Add a review (Protected, must have purchased)
export const addReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, orderId, rating, comment, title, images } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!productId || !orderId || rating == null) {
            return res.status(400).json({
                success: false,
                message: 'productId, orderId, and rating are required',
            });
        }

        const numericRating = Number(rating);
        if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5',
            });
        }

        // Verify delivered order belongs to customer
        const order = await Order.findOne({
            _id: orderId,
            customer: userId,
            status: 'Delivered',
        });

        if (!order) {
            return res.status(400).json({
                success: false,
                message: 'You can only review products from delivered orders.',
            });
        }

        // Confirm product was in this order via OrderItem
        const orderItem = await OrderItem.findOne({
            order: orderId,
            product: productId,
            sellerStatus: { $ne: 'Rejected' },
        });

        if (!orderItem) {
            return res.status(400).json({
                success: false,
                message: 'This product was not found in the delivered order.',
            });
        }

        const existingReview = await Review.findOne({
            customer: userId,
            product: productId,
            order: orderId,
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this product for this order.',
            });
        }

        const review = await Review.create({
            customer: userId,
            product: productId,
            order: orderId,
            rating: numericRating,
            comment,
            title,
            images,
            status: 'Approved',
            isVerifiedPurchase: true,
        });

        await updateProductRatingAggregates(productId);

        const populated = await Review.findById(review._id).populate('customer', 'name');

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: populated,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding review',
            error: error.message,
        });
    }
};
