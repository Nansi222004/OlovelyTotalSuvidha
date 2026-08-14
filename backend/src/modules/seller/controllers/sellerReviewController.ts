import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../../../models/Review';
import Product from '../../../models/Product';
import { asyncHandler } from '../../../utils/asyncHandler';

/**
 * List reviews for products owned by the logged-in seller
 */
export const getSellerReviews = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const productId = req.query.productId as string | undefined;

    const productQuery: any = { seller: sellerId };
    if (productId) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID',
            });
        }
        productQuery._id = productId;
    }

    const sellerProducts = await Product.find(productQuery).select('_id');
    const productIds = sellerProducts.map((p) => p._id);

    const filter: any = {
        product: { $in: productIds },
        status: 'Approved',
    };

    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate('customer', 'name')
            .populate('product', 'productName mainImage rating reviewsCount')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Review.countDocuments(filter),
    ]);

    return res.status(200).json({
        success: true,
        data: {
            reviews,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit) || 1,
                limit,
            },
        },
    });
});

/**
 * Aggregate rating stats across the seller's catalog
 */
export const getSellerReviewStats = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;

    const sellerProducts = await Product.find({ seller: sellerId }).select('_id');
    const productIds = sellerProducts.map((p) => p._id);

    if (productIds.length === 0) {
        return res.status(200).json({
            success: true,
            data: {
                avgRating: 0,
                totalReviews: 0,
                breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            },
        });
    }

    const [avgStats, breakdownStats] = await Promise.all([
        Review.aggregate([
            { $match: { product: { $in: productIds }, status: 'Approved' } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$rating' },
                    count: { $sum: 1 },
                },
            },
        ]),
        Review.aggregate([
            { $match: { product: { $in: productIds }, status: 'Approved' } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
        ]),
    ]);

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownStats.forEach((row: { _id: number; count: number }) => {
        if (row._id >= 1 && row._id <= 5) {
            breakdown[row._id] = row.count;
        }
    });

    const avgRating = avgStats.length > 0 ? Math.round(avgStats[0].avgRating * 10) / 10 : 0;
    const totalReviews = avgStats.length > 0 ? avgStats[0].count : 0;

    return res.status(200).json({
        success: true,
        data: {
            avgRating,
            totalReviews,
            breakdown,
        },
    });
});
