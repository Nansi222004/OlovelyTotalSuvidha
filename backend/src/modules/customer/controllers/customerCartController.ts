
import { Request, Response } from 'express';
import Cart from '../../../models/Cart';
import CartItem from '../../../models/CartItem';
import Product from '../../../models/Product';
import { findSellersWithinRange } from '../../../utils/locationHelper';
import mongoose from 'mongoose';
import AppSettings from '../../../models/AppSettings';
import { getRoadDistances } from '../../../services/mapService';
import Seller from '../../../models/Seller';

// Helper to calculate item price matching frontend logic
const calculateItemPrice = (product: any, variationSelector: any) => {
    let variation = null;
    let variationId = variationSelector;

    // Handle if variationSelector is an object (some implementations store it differently)
    if (variationSelector && typeof variationSelector === 'object' && variationSelector._id) {
        variationId = variationSelector._id;
    }

    if (variationId && product.variations?.length) {
        variation = product.variations.find((v: any) =>
            (v._id && v._id.toString() === variationId.toString()) ||
            (v.id && v.id === variationId)
        );
    }

    let finalPrice = variation?.price || product.price || 0;

    // Priority: Variation Discount -> Product Discount -> Variation Price -> Product Price
    if (variation?.discPrice && variation.discPrice > 0) {
        finalPrice = variation.discPrice;
    } else if (product.discPrice && product.discPrice > 0) {
        finalPrice = product.discPrice;
    }

    return finalPrice;
};

// Helper to calculate cart total with location filtering
const calculateCartTotal = async (cartId: any, nearbySellerIds: mongoose.Types.ObjectId[] = []) => {
    const items = await CartItem.find({ cart: cartId }).populate({
        path: 'product',
        select: 'price discPrice variations seller status publish productName'
    });

    let total = 0;
    for (const item of items) {
        const product = item.product as any;
        if (product && product.status === 'Active' && product.publish) {
            // Check if seller is in range
            const isAvailable = nearbySellerIds.some(id => id.toString() === product.seller.toString());
            if (isAvailable) {
                const price = calculateItemPrice(product, item.variation);
                total += price * item.quantity;
            }
        }
    }
    return total;
};

// Helper to calculate delivery fee
const calculateDeliveryStuff = async (total: number, items: any[], userLat: number | null, userLng: number | null, deliveryOption: string = 'Standard') => {
    let estimatedDeliveryFee = 0;
    let platformFee = 0;
    let freeDeliveryThreshold = 0;
    let minimumOrderValue = 0;

    try {
        const settings = await AppSettings.getSettings();
        platformFee = settings.platformFee ?? 2;
        freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 199;
        minimumOrderValue = settings.minimumOrderValue ?? 0;

        // Check free delivery threshold
        if (freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold) {
            estimatedDeliveryFee = 0;
        }
        // Standard Delivery: Always Fixed Price
        else if (deliveryOption === 'Standard') {
            estimatedDeliveryFee = settings.deliveryCharges ?? 40;
        }
        // Instant Delivery: Distance Based (if config exists)
        else if (deliveryOption === 'Instant' && settings.deliveryConfig) {
            const config = settings.deliveryConfig;
            // Default to base charge
            estimatedDeliveryFee = config.baseCharge || 0;

            if (userLat && userLng) {
                // Get all sellers involved in the cart
                const sellerIds = new Set<string>();
                items.forEach((item: any) => {
                    if (item.product?.seller) {
                        sellerIds.add(item.product.seller.toString());
                    }
                });

                if (sellerIds.size > 0) {
                    const uniqueSellerIds = Array.from(sellerIds).map(id => new mongoose.Types.ObjectId(id));
                    const sellers = await Seller.find({ _id: { $in: uniqueSellerIds } }).select('location latitude longitude');

                    const sellerLocations: { lat: number; lng: number }[] = [];
                    sellers.forEach(seller => {
                        let lat, lng;
                        if (seller.location?.coordinates?.length === 2) {
                            lng = seller.location.coordinates[0];
                            lat = seller.location.coordinates[1];
                        } else if (seller.latitude && seller.longitude) {
                            lat = parseFloat(seller.latitude);
                            lng = parseFloat(seller.longitude);
                        }
                        if (lat && lng) sellerLocations.push({ lat, lng });
                    });

                    if (sellerLocations.length > 0) {
                        const distances = await getRoadDistances(
                            sellerLocations,
                            { lat: userLat, lng: userLng },
                            config.googleMapsKey
                        );

                        if (distances && distances.length > 0) {
                            const maxDistance = Math.max(...distances);
                            const extraKm = Math.max(0, maxDistance - config.baseDistance);
                            estimatedDeliveryFee = Math.ceil(config.baseCharge + (extraKm * config.kmRate));
                        }
                    }
                }
            }
        } else {
            // Fallback for unknown options
            estimatedDeliveryFee = settings.deliveryCharges ?? 40;
        }
    } catch (err) {
        console.error("Error calculating delivery stuff:", err);
    }
    return {
        estimatedDeliveryFee,
        platformFee,
        freeDeliveryThreshold,
        minimumOrderValue,
    };
};

// Get current user's cart
export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { latitude, longitude } = req.query;

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        const hasValidLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

        if (hasValidLocation) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        let cart = await Cart.findOne({ customer: userId }).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations'
            }
        });

        if (!cart) {
            cart = await Cart.create({ customer: userId, items: [], total: 0 });
            return res.status(200).json({ success: true, data: cart });
        }

        // Filter items based on location availability and update total
        const filteredItems = [];
        const unavailableItems = [];
        let total = 0;

        for (const item of (cart.items as any)) {
            const product = item.product;
            if (product && product.status === 'Active' && product.publish) {
                // If no location provided, include all items
                if (!hasValidLocation) {
                    filteredItems.push(item);
                    const price = calculateItemPrice(product, item.variation);
                    total += price * item.quantity;
                } else {
                    // Check if available at location
                    const isAvailable = nearbySellerIds.some(id => id.toString() === product.seller.toString());
                    if (isAvailable) {
                        filteredItems.push(item);
                        const price = calculateItemPrice(product, item.variation);
                        total += price * item.quantity;
                    } else {
                        unavailableItems.push(item);
                    }
                }
            }
        }

        // Update cart total in DB if it changed
        if (cart.total !== total) {
            cart.total = total;
            await cart.save();
        }

        // Calculate fees
        const deliveryOption = (req.query.deliveryOption as string) || 'Standard';
        const fees = await calculateDeliveryStuff(total, filteredItems, userLat, userLng, deliveryOption);

        return res.status(200).json({
            success: true,
            data: {
                ...cart.toObject(),
                items: filteredItems,
                unavailableItems: unavailableItems, // Include unavailable items
                total,
                ...fees
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching cart',
            error: error.message
        });
    }
};

// Add item to cart
export const addToCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, quantity = 1, variation } = req.body;
        const { latitude, longitude } = req.query;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
            return res.status(400).json({
                success: false,
                message: 'Location is required to add items to cart'
            });
        }

        // Verify product exists and is available at location
        const product = await Product.findOne({ _id: productId, status: 'Active', publish: true }).populate('seller');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        // Check if seller's shop is open
        const seller = product.seller as any;
        if (seller && seller.isShopOpen === false) {
            return res.status(400).json({
                success: false,
                message: 'Seller is not available at this moment'
            });
        }

        const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        const isAvailable = nearbySellerIds.some(id => id.toString() === (seller._id || seller).toString());

        if (!isAvailable) {
            return res.status(403).json({
                success: false,
                message: 'This product is not available in your current location'
            });
        }

        // Get or create cart
        let cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            cart = await Cart.create({ customer: userId, items: [], total: 0 });
        }

        // Check if item already exists in cart
        let cartItem = await CartItem.findOne({
            cart: cart._id,
            product: productId,
            variation: variation || null
        });

        if (cartItem) {
            // Update quantity
            cartItem.quantity += quantity;
            await cartItem.save();
        } else {
            // Create new cart item
            cartItem = await CartItem.create({
                cart: cart._id,
                product: productId,
                quantity,
                variation
            });
            cart.items.push(cartItem._id as any);
        }

        // Update total with location filtering
        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        // Return updated cart with filtering
        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations'
            }
        });

        const filteredItems = (updatedCart?.items as any[] || []).filter(item => {
            const prod = item.product;
            return prod && nearbySellerIds.some(id => id.toString() === prod.seller.toString());
        });

        // Calculate fees
        const deliveryOption = (req.body.deliveryOption as string) || (req.query.deliveryOption as string) || 'Standard';
        const fees = await calculateDeliveryStuff(cart.total, filteredItems, userLat, userLng, deliveryOption);

        return res.status(200).json({
            success: true,
            message: 'Item added to cart',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total,
                ...fees
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding to cart',
            error: error.message
        });
    }
};

// Update item quantity
export const updateCartItem = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { itemId } = req.params;
        const { quantity } = req.body;
        const { latitude, longitude } = req.query;

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
            return res.status(400).json({
                success: false,
                message: 'Location is required to update cart'
            });
        }

        const nearbySellerIds = await findSellersWithinRange(userLat, userLng);

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({ _id: itemId, cart: cart._id }).populate('product');
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        // Verify item is still available at location
        const product = cartItem.product as any;
        const isAvailable = product && nearbySellerIds.some(id => id.toString() === product.seller.toString());

        if (!isAvailable) {
            return res.status(403).json({
                success: false,
                message: 'This item is no longer available in your location'
            });
        }

        cartItem.quantity = quantity;
        await cartItem.save();

        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations'
            }
        });

        const filteredItems = (updatedCart?.items as any[] || []).filter(item => {
            const prod = item.product;
            return prod && nearbySellerIds.some(id => id.toString() === prod.seller.toString());
        });

        // Calculate fees
        const deliveryOption = (req.body.deliveryOption as string) || (req.query.deliveryOption as string) || 'Standard';
        const fees = await calculateDeliveryStuff(cart.total, filteredItems, userLat, userLng, deliveryOption);

        return res.status(200).json({
            success: true,
            message: 'Cart updated',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total,
                ...fees
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error updating cart item',
            error: error.message
        });
    }
};

// Remove item from cart
export const removeFromCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { itemId } = req.params;
        const { latitude, longitude } = req.query;

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        await CartItem.findOneAndDelete({ _id: itemId, cart: cart._id });

        // Remove from cart array
        cart.items = cart.items.filter(id => id.toString() !== itemId);

        // Calculate total with location if provided
        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations'
            }
        });

        const filteredItems = (updatedCart?.items as any[] || []).filter(item => {
            const prod = item.product;
            if (nearbySellerIds.length > 0) {
                return prod && nearbySellerIds.some(id => id.toString() === prod.seller.toString());
            }
            return true; // If no location provided for removal, just return all (though getCart will filter)
        });

        // Calculate fees
        const deliveryOption = (req.query.deliveryOption as string) || 'Standard';
        const fees = await calculateDeliveryStuff(cart.total, filteredItems, userLat, userLng, deliveryOption);

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total,
                ...fees
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error removing from cart',
            error: error.message
        });
    }
};

// Clear cart
export const clearCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const cart = await Cart.findOne({ customer: userId });

        if (cart) {
            await CartItem.deleteMany({ cart: cart._id });
            cart.items = [];
            cart.total = 0;
            await cart.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Cart cleared',
            data: { items: [], total: 0 }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error clearing cart',
            error: error.message
        });
    }
};
