import { Request, Response } from 'express';
import Cart from '../../../models/Cart';
import CartItem from '../../../models/CartItem';
import Product from '../../../models/Product';
import Category from '../../../models/Category';
// Ensure Category model is registered for populate
void Category;
import { findSellersWithinRange } from '../../../utils/locationHelper';
import mongoose from 'mongoose';
import AppSettings from '../../../models/AppSettings';
import { getRoadDistances } from '../../../services/mapService';
import Seller from '../../../models/Seller';
import { checkWholesaleEligibility, validateWholesalePrice } from '../../../utils/categoryChannelHelper';

// Helper to calculate item price matching frontend logic
const calculateItemPrice = (product: any, variationSelector: any) => {
    let variation = null;
    let variationId = variationSelector;

    // Handle if variationSelector is an object
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

// Helper to calculate delivery fee for Quick Commerce
const calculateDeliveryStuff = async (total: number, items: any[], userLat: number | null, userLng: number | null, deliveryOption: string = 'Standard') => {
    let estimatedDeliveryFee = 0;
    let platformFee = 0;
    let freeDeliveryThreshold = 0;
    let minimumOrderValue = 0;

    try {
        const settings = await AppSettings.findOne();
        platformFee = settings?.platformFee ?? 2;
        freeDeliveryThreshold = settings?.freeDeliveryThreshold ?? 199;
        minimumOrderValue = settings?.minimumOrderValue ?? 0;

        // Global Free Delivery Threshold: waives ALL delivery charges (Standard and Instant distance-based)
        if (freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold) {
            estimatedDeliveryFee = 0;
        } else if (deliveryOption === 'Instant' && settings?.deliveryConfig) {
            const config = settings.deliveryConfig;
            estimatedDeliveryFee = config.baseCharge || 0;

            if (userLat && userLng) {
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

                        if (distances.length > 0) {
                            const maxDistance = Math.max(...distances);
                            if (maxDistance > config.baseDistance) {
                                const extraDistance = maxDistance - config.baseDistance;
                                const extraCharge = Math.ceil(extraDistance * config.kmRate);
                                estimatedDeliveryFee += extraCharge;
                            }
                        }
                    }
                }
            }
        } else {
            estimatedDeliveryFee = settings?.deliveryCharges ?? 25;
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

/**
 * Build unified cart response with distinct Quick Commerce and Ecommerce groups
 */
const buildUnifiedCartResponse = async (
    cart: any,
    nearbySellerIds: mongoose.Types.ObjectId[],
    hasValidLocation: boolean,
    userLat: number | null,
    userLng: number | null,
    deliveryOption: string = 'Standard'
) => {
    const qcItems: any[] = [];
    const ecomItems: any[] = [];
    const unavailableItems: any[] = [];

    let qcSubtotal = 0;
    let ecomSubtotal = 0;

    for (const item of (cart.items as any[] || [])) {
        const product = item.product;
        if (!product || product.status !== 'Active' || !product.publish) {
            continue;
        }

        const itemProductType = item.productType || product.productType || 'QUICK_COMMERCE';
        let price = calculateItemPrice(product, item.variation);

        // Authoritative Wholesale Pricing & 4-Gate Eligibility Revalidation
        if (item.isWholesale) {
            const seller = await Seller.findById(product.seller).select('wholesaleEnabled').lean();
            const category = await Category.findById(product.category).select('wholesaleEnabled').lean();
            const appSettings = await AppSettings.findOne().select('wholesaleSettings').lean();
            const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

            const eligibility = checkWholesaleEligibility({
                globalWholesaleEnabled,
                sellerWholesaleEnabled: !!seller?.wholesaleEnabled,
                categoryWholesaleEnabled: !!category?.wholesaleEnabled,
                productWholesaleEnabled: !!product.wholesaleEnabled,
            });

            if (!eligibility.eligible) {
                // Wholesale capability was revoked after item was added to cart
                // DO NOT silently convert to retail pricing! Mark unavailable.
                unavailableItems.push({
                    ...(item.toObject ? item.toObject() : item),
                    unavailableReason: `Wholesale ineligible: ${eligibility.reason}`,
                });
                continue;
            }

            // Authoritative wholesale price from DB
            const dbWholesalePrice = Number(product.wholesalePrice);
            if (dbWholesalePrice && dbWholesalePrice > 0) {
                price = dbWholesalePrice;
            }
        }

        const itemTotal = price * item.quantity;

        if (itemProductType === 'ECOMMERCE') {
            // Ecommerce items: NOT subject to local seller radius filtering!
            ecomItems.push(item);
            ecomSubtotal += itemTotal;
        } else {
            // Quick Commerce items: requires seller range check if location is known
            if (!hasValidLocation) {
                qcItems.push(item);
                qcSubtotal += itemTotal;
            } else {
                const isAvailable = nearbySellerIds.some(
                    (id) => id.toString() === (product.seller?._id || product.seller)?.toString()
                );
                if (isAvailable) {
                    qcItems.push(item);
                    qcSubtotal += itemTotal;
                } else {
                    unavailableItems.push(item);
                }
            }
        }
    }

    const totalProductSubtotal = Number((qcSubtotal + ecomSubtotal).toFixed(2));

    // Update cart total in DB
    if (cart.total !== totalProductSubtotal) {
        cart.total = totalProductSubtotal;
        await cart.save();
    }

    const settings = await AppSettings.findOne();

    // Quick Commerce fees: only calculate if qcItems exist
    const qcDeliveryOption = deliveryOption?.toLowerCase() === 'instant' ? 'Instant' : 'Standard';
    const freeDeliveryThreshold = settings?.freeDeliveryThreshold ?? 199;
    const isEligibleForFreeDelivery = freeDeliveryThreshold > 0 && totalProductSubtotal >= freeDeliveryThreshold;

    let qcDeliveryFee = 0;
    let platformFee = settings?.platformFee ?? 2;
    let minimumOrderValue = settings?.minimumOrderValue ?? 0;

    if (qcItems.length > 0) {
        const qcFees = await calculateDeliveryStuff(totalProductSubtotal, qcItems, userLat, userLng, qcDeliveryOption);
        qcDeliveryFee = qcFees.estimatedDeliveryFee;
        platformFee = qcFees.platformFee;
        minimumOrderValue = qcFees.minimumOrderValue;
    }

    // Ecommerce shipping fee: governed by the single global freeDeliveryThreshold on combined subtotal!
    const ecomDefaultFee = Number.isFinite(settings?.ecommerceShippingFee)
        ? Number(settings?.ecommerceShippingFee)
        : 40;
    let ecomShippingFee = 0;
    if (ecomItems.length > 0) {
        ecomShippingFee = isEligibleForFreeDelivery ? 0 : ecomDefaultFee;
    }

    const combinedDeliveryFee = qcDeliveryFee + ecomShippingFee;

    const groups = {
        quickCommerce: {
            fulfillmentType: 'LOCAL_DELIVERY',
            title: '⚡ QUICK DELIVERY',
            estimatedDeliveryTime: '10–30 min',
            items: qcItems,
            subtotal: Number(qcSubtotal.toFixed(2)),
            deliveryFee: qcDeliveryFee,
            allowedDeliveryOptions: [
                {
                    id: 'Standard',
                    label: 'Standard Delivery',
                    estimatedTime: 'Expected in 1–2 days',
                },
                {
                    id: 'Instant',
                    label: 'Instant Delivery',
                    estimatedTime: 'Expected in 10–15 mins',
                },
            ],
            selectedDeliveryOption: qcDeliveryOption,
        },
        ecommerce: {
            fulfillmentType: 'COURIER_SHIPPING',
            title: '📦 STANDARD SHIPPING',
            estimatedDeliveryTime: '3–7 days',
            items: ecomItems,
            subtotal: Number(ecomSubtotal.toFixed(2)),
            shippingFee: ecomShippingFee,
            allowedDeliveryOptions: [
                {
                    id: 'Courier',
                    label: 'Courier Delivery',
                    estimatedTime: 'Expected in 3–7 days',
                },
            ],
            selectedDeliveryOption: 'Courier',
        },
    };

    return {
        ...cart.toObject(),
        items: [...qcItems, ...ecomItems], // All available active items
        unavailableItems,
        groups,
        total: totalProductSubtotal,
        estimatedDeliveryFee: combinedDeliveryFee,
        qcDeliveryFee,
        ecomShippingFee,
        platformFee,
        freeDeliveryThreshold,
        minimumOrderValue,
        giftPackagingFee: settings?.giftPackagingFee ?? 30,
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
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity'
            }
        });

        if (!cart) {
            cart = await Cart.create({ customer: userId, items: [], total: 0 });
            return res.status(200).json({
                success: true,
                data: {
                    ...cart.toObject(),
                    groups: {
                        quickCommerce: {
                            fulfillmentType: 'LOCAL_DELIVERY',
                            title: '⚡ QUICK DELIVERY',
                            estimatedDeliveryTime: '10–30 min',
                            items: [],
                            subtotal: 0,
                            deliveryFee: 0,
                            allowedDeliveryOptions: [
                                { id: 'Standard', label: 'Standard Delivery', estimatedTime: 'Expected in 1–2 days' },
                                { id: 'Instant', label: 'Instant Delivery', estimatedTime: 'Expected in 10–15 mins' },
                            ],
                            selectedDeliveryOption: 'Standard',
                        },
                        ecommerce: {
                            fulfillmentType: 'COURIER_SHIPPING',
                            title: '📦 STANDARD SHIPPING',
                            estimatedDeliveryTime: '3–7 days',
                            items: [],
                            subtotal: 0,
                            shippingFee: 0,
                            allowedDeliveryOptions: [
                                { id: 'Courier', label: 'Courier Delivery', estimatedTime: 'Expected in 3–7 days' },
                            ],
                            selectedDeliveryOption: 'Courier',
                        },
                    },
                },
            });
        }

        const deliveryOption = (req.query.deliveryOption as string) || 'Standard';
        const responseData = await buildUnifiedCartResponse(
            cart,
            nearbySellerIds,
            hasValidLocation,
            userLat,
            userLng,
            deliveryOption
        );

        return res.status(200).json({
            success: true,
            data: responseData,
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
        const { productId, quantity = 1, variation, isWholesale: clientRequestsWholesale = false } = req.body;
        const { latitude, longitude } = req.query;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Verify product exists — also populate seller and category for wholesale gate
        const product = await Product.findOne({ _id: productId, status: 'Active', publish: true })
            .populate('seller')
            .populate('category');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        // ── WHOLESALE ELIGIBILITY GATE ─────────────────────────────────────────
        // Server enforces all 4 layers: Global → Seller → Category → Product
        // Client can signal intent with isWholesale=true but server validates it.
        let serverIsWholesale = false;
        let serverWholesalePrice: number | undefined = undefined;
        let serverWholesaleMOQ: number | undefined = undefined;

        if (clientRequestsWholesale) {
            const settings = await AppSettings.findOne().select('wholesaleSettings').lean();
            const globalEnabled = settings?.wholesaleSettings?.wholesaleEnabled ?? false;
            const seller = product.seller as any;
            const category = product.category as any;

            const eligibility = checkWholesaleEligibility({
                globalWholesaleEnabled: globalEnabled,
                sellerWholesaleEnabled: seller?.wholesaleEnabled ?? false,
                categoryWholesaleEnabled: category?.wholesaleEnabled ?? false,
                productWholesaleEnabled: (product as any).wholesaleEnabled ?? false,
            });

            if (!eligibility.eligible) {
                return res.status(400).json({
                    success: false,
                    message: `Wholesale not available: ${eligibility.reason}`,
                });
            }

            // Validate wholesale price server-side
            const wp = (product as any).wholesalePrice;
            const rp = (product as any).price || 0;
            if (!wp || wp <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This product does not have a wholesale price configured',
                });
            }
            const priceCheck = validateWholesalePrice(wp, rp);
            if (!priceCheck.valid) {
                return res.status(400).json({ success: false, message: priceCheck.error });
            }

            serverIsWholesale = true;
            serverWholesalePrice = wp;
            serverWholesaleMOQ = (product as any).wholesaleMinimumQuantity ?? 1;
        }
        // ──────────────────────────────────────────────────────────────────────

        const isEcommerceProduct = product.productType === 'ECOMMERCE';

        // Location verification is ONLY required for Quick Commerce products
        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        let hasValidLocation = false;
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        if (!isEcommerceProduct) {
            if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
                return res.status(400).json({
                    success: false,
                    message: 'Location is required to add Quick Commerce items to cart'
                });
            }

            // Check if seller's shop is open
            const seller = product.seller as any;
            if (seller && seller.isShopOpen === false) {
                return res.status(400).json({
                    success: false,
                    message: 'Seller is not available at this moment'
                });
            }

            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
            const isAvailable = nearbySellerIds.some(id => id.toString() === (seller._id || seller).toString());

            if (!isAvailable) {
                return res.status(403).json({
                    success: false,
                    message: 'This service is not available in your location yet.'
                });
            }
            hasValidLocation = true;
        } else if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
            hasValidLocation = true;
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

        let sanitizedQuantity = parseInt(quantity as any, 10);
        if (isNaN(sanitizedQuantity) || sanitizedQuantity < 1) {
            sanitizedQuantity = 1;
        }

        // ── MOQ ENFORCEMENT ───────────────────────────────────────────────────
        // If wholesale, re-read server MOQ and enforce. Never trust client quantity alone.
        if (serverIsWholesale && serverWholesaleMOQ && sanitizedQuantity < serverWholesaleMOQ) {
            return res.status(400).json({
                success: false,
                message: `Minimum order quantity for wholesale is ${serverWholesaleMOQ} units. You requested ${sanitizedQuantity}.`,
                data: { minimumQuantity: serverWholesaleMOQ, requested: sanitizedQuantity },
            });
        }
        // ──────────────────────────────────────────────────────────────────────

        const maxStock = typeof (product as any).stock === 'number' && (product as any).stock > 0 ? (product as any).stock : 999;
        const maxAllowedQty = (!serverIsWholesale && (product as any).totalAllowedQuantity && (product as any).totalAllowedQuantity > 0)
            ? Math.min(maxStock, (product as any).totalAllowedQuantity)
            : maxStock;

        if (cartItem) {
            const newQty = cartItem.quantity + sanitizedQuantity;
            // Re-enforce MOQ on updates too
            if (serverIsWholesale && serverWholesaleMOQ && newQty < serverWholesaleMOQ) {
                return res.status(400).json({
                    success: false,
                    message: `Wholesale minimum order quantity is ${serverWholesaleMOQ} units.`,
                    data: { minimumQuantity: serverWholesaleMOQ },
                });
            }
            cartItem.quantity = Math.min(maxAllowedQty, newQty);
            if (serverIsWholesale) {
                (cartItem as any).isWholesale = true;
                (cartItem as any).wholesalePrice = serverWholesalePrice;
                (cartItem as any).wholesaleMinimumQuantity = serverWholesaleMOQ;
            }
            await cartItem.save();
        } else {
            cartItem = await CartItem.create({
                cart: cart._id,
                product: productId,
                quantity: Math.min(maxAllowedQty, sanitizedQuantity),
                variation: variation || null,
                productType: product.productType || 'QUICK_COMMERCE',
                isWholesale: serverIsWholesale,
                wholesalePrice: serverWholesalePrice,
                wholesaleMinimumQuantity: serverWholesaleMOQ,
            });
            cart.items.push(cartItem._id as any);
            await cart.save();
        }

        // Reload updated cart with full population
        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity'
            }
        });

        const deliveryOption = (req.body.deliveryOption as string) || (req.query.deliveryOption as string) || 'Standard';
        const responseData = await buildUnifiedCartResponse(
            updatedCart,
            nearbySellerIds,
            hasValidLocation,
            userLat,
            userLng,
            deliveryOption
        );

        return res.status(200).json({
            success: true,
            message: 'Item added to cart',
            data: responseData,
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

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({ _id: itemId, cart: cart._id }).populate('product');
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        const product = cartItem.product as any;
        const isEcommerceProduct = cartItem.productType === 'ECOMMERCE' || product?.productType === 'ECOMMERCE';

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;
        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        const hasValidLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

        if (hasValidLocation) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        // Quick Commerce items must remain serviceable
        if (!isEcommerceProduct && hasValidLocation && product?.seller) {
            const isAvailable = nearbySellerIds.some(id => id.toString() === product.seller.toString());
            if (!isAvailable) {
                return res.status(403).json({
                    success: false,
                    message: 'This service is not available in your location yet.'
                });
            }
        }

        let parsedQuantity = parseInt(quantity as any, 10);
        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        // Enforce Wholesale MOQ on update (No silent adjustments)
        if (cartItem.isWholesale) {
            const authoritativeMoq = Math.max(1, Number(product?.wholesaleMinimumQuantity) || Number((cartItem as any).wholesaleMinimumQuantity) || 1);
            if (parsedQuantity < authoritativeMoq) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum order quantity for wholesale is ${authoritativeMoq} units. You requested ${parsedQuantity}.`,
                    data: { minimumQuantity: authoritativeMoq, requested: parsedQuantity },
                });
            }
        }

        const maxStock = typeof product?.stock === 'number' && product.stock > 0 ? product.stock : 999;
        const maxAllowedQty = (!cartItem.isWholesale && product?.totalAllowedQuantity && product.totalAllowedQuantity > 0)
            ? Math.min(maxStock, product.totalAllowedQuantity)
            : maxStock;

        cartItem.quantity = Math.min(maxAllowedQty, parsedQuantity);
        await cartItem.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity'
            }
        });

        const deliveryOption = (req.body.deliveryOption as string) || (req.query.deliveryOption as string) || 'Standard';
        const responseData = await buildUnifiedCartResponse(
            updatedCart,
            nearbySellerIds,
            hasValidLocation,
            userLat,
            userLng,
            deliveryOption
        );

        return res.status(200).json({
            success: true,
            message: 'Cart updated',
            data: responseData,
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

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        await CartItem.findOneAndDelete({ _id: itemId, cart: cart._id });
        cart.items = cart.items.filter(id => id.toString() !== itemId);
        await cart.save();

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;
        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        const hasValidLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

        if (hasValidLocation) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: 'productName price mainImage stock pack mrp category seller status publish discPrice variations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity'
            }
        });

        const deliveryOption = (req.query.deliveryOption as string) || 'Standard';
        const responseData = await buildUnifiedCartResponse(
            updatedCart,
            nearbySellerIds,
            hasValidLocation,
            userLat,
            userLng,
            deliveryOption
        );

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: responseData,
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
            data: {
                items: [],
                total: 0,
                groups: {
                    quickCommerce: {
                        fulfillmentType: 'LOCAL_DELIVERY',
                        title: '⚡ QUICK DELIVERY',
                        estimatedDeliveryTime: '10–30 min',
                        items: [],
                        subtotal: 0,
                        deliveryFee: 0,
                    },
                    ecommerce: {
                        fulfillmentType: 'COURIER_SHIPPING',
                        title: '📦 STANDARD SHIPPING',
                        estimatedDeliveryTime: '3–7 days',
                        items: [],
                        subtotal: 0,
                        shippingFee: 0,
                    },
                },
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error clearing cart',
            error: error.message
        });
    }
};
