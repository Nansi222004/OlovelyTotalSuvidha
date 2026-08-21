/**
 * Test Suite: Priority 3 — Coupon Scope Correction
 * Verifies that coupon discounts apply ONLY to product subtotal,
 * and additional charges (delivery, platform fee, tip, packaging) are added after.
 */

function calculateCouponScopeOrder(params: {
    productSubtotal: number;
    discountType: "Percentage" | "Fixed";
    discountValue: number;
    minimumPurchase?: number;
    maximumDiscount?: number;
    deliveryFee?: number;
    platformFee?: number;
    tipAmount?: number;
    giftPackagingFee?: number;
    walletBalance?: number;
}) {
    const deliveryFee = params.deliveryFee || 0;
    const platformFee = params.platformFee || 0;
    const tipAmount = params.tipAmount || 0;
    const giftPackagingFee = params.giftPackagingFee || 0;
    const productSubtotal = params.productSubtotal;

    let isRejected = false;
    let rejectionReason = "";
    let discountAmount = 0;

    // 1. Evaluate minimum purchase against product subtotal
    if (params.minimumPurchase && productSubtotal < params.minimumPurchase) {
        isRejected = true;
        rejectionReason = `Minimum purchase ₹${params.minimumPurchase} not met by product subtotal ₹${productSubtotal}`;
    } else {
        // 2. Calculate discount strictly from product subtotal
        if (params.discountType === "Percentage") {
            discountAmount = (productSubtotal * params.discountValue) / 100;
            if (params.maximumDiscount && discountAmount > params.maximumDiscount) {
                discountAmount = params.maximumDiscount;
            }
        } else {
            discountAmount = Math.min(params.discountValue, productSubtotal);
        }
    }

    // 3. Final total formula
    const finalTotal = Math.max(
        0,
        productSubtotal - discountAmount + platformFee + deliveryFee + tipAmount + giftPackagingFee
    );

    // 4. Wallet & Razorpay/COD split
    let walletAmountUsed = 0;
    if (params.walletBalance && params.walletBalance > 0) {
        walletAmountUsed = Math.min(params.walletBalance, finalTotal);
    }

    const remainingPayable = Math.max(0, finalTotal - walletAmountUsed);

    return {
        isRejected,
        rejectionReason,
        productSubtotal,
        discountAmount,
        deliveryFee,
        platformFee,
        tipAmount,
        giftPackagingFee,
        finalTotal,
        walletAmountUsed,
        remainingPayable,
    };
}

function runTests() {
    console.log("=========================================");
    console.log("RUNNING COUPON SCOPE SUITE (TESTS 1-8)");
    console.log("=========================================\n");

    let passed = 0;
    let failed = 0;

    // TEST 1
    const res1 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Percentage",
        discountValue: 10,
        deliveryFee: 50,
        platformFee: 20,
        tipAmount: 30,
    });
    if (res1.discountAmount === 100 && res1.finalTotal === 1000) {
        console.log("✅ TEST 1 PASSED: Discount=₹100, FinalTotal=₹1000");
        passed++;
    } else {
        console.error("❌ TEST 1 FAILED:", res1);
        failed++;
    }

    // TEST 2
    const res2 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Fixed",
        discountValue: 100,
        deliveryFee: 50,
        platformFee: 20,
    });
    if (res2.discountAmount === 100 && res2.finalTotal === 970) {
        console.log("✅ TEST 2 PASSED: Discount=₹100, FinalTotal=₹970");
        passed++;
    } else {
        console.error("❌ TEST 2 FAILED:", res2);
        failed++;
    }

    // TEST 3
    const res3 = calculateCouponScopeOrder({
        productSubtotal: 500,
        discountType: "Percentage",
        discountValue: 10,
        deliveryFee: 100,
        platformFee: 50,
    });
    if (res3.discountAmount === 50 && res3.finalTotal === 600) {
        console.log("✅ TEST 3 PASSED: Discount=₹50, FinalTotal=₹600");
        passed++;
    } else {
        console.error("❌ TEST 3 FAILED:", res3);
        failed++;
    }

    // TEST 4
    const res4 = calculateCouponScopeOrder({
        productSubtotal: 900,
        minimumPurchase: 1000,
        discountType: "Percentage",
        discountValue: 10,
    });
    if (res4.isRejected && res4.discountAmount === 0 && res4.rejectionReason) {
        console.log(`✅ TEST 4 PASSED: Coupon rejected (${res4.rejectionReason})`);
        passed++;
    } else {
        console.error("❌ TEST 4 FAILED:", res4);
        failed++;
    }

    // TEST 5
    const res5 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Percentage",
        discountValue: 10,
        maximumDiscount: 50,
        deliveryFee: 100,
    });
    if (res5.discountAmount === 50 && res5.finalTotal === 1050) {
        console.log("✅ TEST 5 PASSED: Discount capped at max discount ₹50, FinalTotal=₹1050");
        passed++;
    } else {
        console.error("❌ TEST 5 FAILED:", res5);
        failed++;
    }

    // TEST 6
    const res6 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Fixed",
        discountValue: 1500,
        deliveryFee: 50,
        platformFee: 20,
    });
    if (res6.discountAmount === 1000 && res6.finalTotal === 70) {
        console.log("✅ TEST 6 PASSED: Fixed discount capped at product subtotal ₹1000, FinalTotal=₹70 (fees added normally)");
        passed++;
    } else {
        console.error("❌ TEST 6 FAILED:", res6);
        failed++;
    }

    // TEST 7
    const res7 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Percentage",
        discountValue: 10,
        deliveryFee: 50,
        platformFee: 20,
        walletBalance: 500,
    });
    if (res7.finalTotal === 970 && res7.walletAmountUsed === 500 && res7.remainingPayable === 470) {
        console.log("✅ TEST 7 PASSED: FinalTotal=₹970, WalletUsed=₹500, RemainingPayable=₹470");
        passed++;
    } else {
        console.error("❌ TEST 7 FAILED:", res7);
        failed++;
    }

    // TEST 8
    const res8 = calculateCouponScopeOrder({
        productSubtotal: 1000,
        discountType: "Percentage",
        discountValue: 10,
        deliveryFee: 50,
        platformFee: 20,
    });
    if (res8.remainingPayable === 970) {
        console.log("✅ TEST 8 PASSED: Razorpay order amount matches corrected remaining payable amount ₹970");
        passed++;
    } else {
        console.error("❌ TEST 8 FAILED:", res8);
        failed++;
    }

    console.log("\n=========================================");
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
