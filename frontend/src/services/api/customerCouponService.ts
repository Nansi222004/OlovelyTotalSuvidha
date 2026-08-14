import api from './config';

export interface Coupon {
    _id: string;
    code: string;
    title: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minOrderValue?: number;
    maxDiscountAmount?: number;
    validFrom: string;
    validUntil: string;
    usageLimit?: number;
    usedCount: number;
    isActive: boolean;
}

export interface ValidateCouponResponse {
    success: boolean;
    data?: {
        isValid: boolean;
        coupon: Coupon;
        discountAmount: number;
        finalTotal: number;
    };
    message?: string;
}

export interface GetCouponsResponse {
    success: boolean;
    data: Coupon[];
}

/**
 * Get all available coupons
 */
export const getCoupons = async (): Promise<GetCouponsResponse> => {
    const response = await api.get<any>('/customer/coupons');
    if (response.data.success && Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map((c: any) => ({
            _id: c._id,
            code: c.code,
            title: c.code, // Use code as title
            description: c.description || '',
            discountType: (c.discountType || 'Fixed').toLowerCase() as 'percentage' | 'fixed',
            discountValue: c.discountValue || 0,
            minOrderValue: c.minimumPurchase,
            maxDiscountAmount: c.maximumDiscount,
            validFrom: c.startDate,
            validUntil: c.endDate,
            usageLimit: c.usageLimit,
            usedCount: c.usageCount || 0,
            isActive: c.isActive
        }));
    }
    return response.data;
};

/**
 * Validate a coupon code
 */
export const validateCoupon = async (code: string, orderTotal: number): Promise<ValidateCouponResponse> => {
    const response = await api.post<any>('/customer/coupons/validate', {
        code,
        orderTotal
    });
    
    if (response.data.success && response.data.data?.coupon) {
        const c = response.data.data.coupon;
        response.data.data.coupon = {
            _id: c._id,
            code: c.code,
            title: c.code,
            description: c.description || '',
            discountType: (c.discountType || 'Fixed').toLowerCase() as 'percentage' | 'fixed',
            discountValue: c.discountValue || 0,
            minOrderValue: c.minimumPurchase,
            maxDiscountAmount: c.maximumDiscount,
            validFrom: c.startDate,
            validUntil: c.endDate,
            usageLimit: c.usageLimit,
            usedCount: c.usageCount || 0,
            isActive: c.isActive
        };
    }
    
    return response.data;
};
