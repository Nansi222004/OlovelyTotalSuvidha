/**
 * COD Payment Flow Automated Test Script
 * 
 * This script tests the complete COD flow using existing test users
 * Mobile: 9111966732 (used for all roles)
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
};

async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        log.success('Connected to MongoDB');

        // Import models after connection
        require('./dist/models');

        return true;
    } catch (error) {
        log.error(`MongoDB connection error: ${error.message}`);
        return false;
    }
}

async function findTestUsers() {
    log.section('STEP 1: Finding Test Users');

    const Customer = mongoose.model('Customer');
    const Seller = mongoose.model('Seller');
    const Delivery = mongoose.model('Delivery');
    const Product = mongoose.model('Product');

    // Try to find users with the test mobile first
    let customer = await Customer.findOne({ phone: '9111966732' });
    let seller = await Seller.findOne({ mobile: '9111966732' });
    let deliveryBoy = await Delivery.findOne({ mobile: '9111966732' });

    // If not found, use any existing users
    if (!customer) {
        customer = await Customer.findOne();
        if (!customer) {
            log.error('No customers found in database');
            return null;
        }
        log.warn(`Using existing customer: ${customer.name} (${customer.phone})`);
    } else {
        log.success(`Customer found: ${customer.name}`);
    }

    if (!seller) {
        seller = await Seller.findOne({ status: 'Approved' });
        if (!seller) {
            log.error('No active sellers found in database');
            return null;
        }
        log.warn(`Using existing seller: ${seller.sellerName} (${seller.mobile})`);
    } else {
        log.success(`Seller found: ${seller.sellerName}`);
    }

    if (!deliveryBoy) {
        deliveryBoy = await Delivery.findOne({ status: 'Active' });
        if (!deliveryBoy) {
            log.error('No active delivery boys found in database');
            return null;
        }
        log.warn(`Using existing delivery boy: ${deliveryBoy.name} (${deliveryBoy.mobile})`);
    } else {
        log.success(`Delivery Boy found: ${deliveryBoy.name}`);
    }

    // Find a product from the seller
    const product = await Product.findOne({ seller: seller._id, status: 'Active' });
    if (!product) {
        log.error('No active products found for seller');
        return null;
    }

    log.success(`Product found: ${product.productName} (₹${product.price})`);

    console.log('DEBUG - Customer keys:', Object.keys(customer.toObject()));
    console.log('DEBUG - Seller keys:', Object.keys(seller.toObject()));
    console.log('DEBUG - Delivery Boy keys:', Object.keys(deliveryBoy.toObject()));
    console.log('DEBUG - Product keys:', Object.keys(product.toObject()));

    console.log('DEBUG - Product Price:', product.price);
    console.log('DEBUG - Product Discount Price:', product.discPrice);

    return { customer, seller, deliveryBoy, product };
}

async function captureInitialState(users) {
    log.section('STEP 2: Capturing Initial State');

    const { seller, deliveryBoy } = users;

    const PlatformWallet = mongoose.model('PlatformWallet');
    const platformWallet = await PlatformWallet.findOne();

    const initialState = {
        seller: {
            balance: seller.balance || 0,
        },
        deliveryBoy: {
            balance: deliveryBoy.balance || 0,
            pendingAdminPayout: deliveryBoy.pendingAdminPayout || 0,
            cashCollected: deliveryBoy.cashCollected || 0,
        },
        platform: platformWallet ? {
            totalPlatformEarning: platformWallet.totalPlatformEarning || 0,
            currentPlatformBalance: platformWallet.currentPlatformBalance || 0,
            totalAdminEarning: platformWallet.totalAdminEarning || 0,
            pendingFromDeliveryBoy: platformWallet.pendingFromDeliveryBoy || 0,
        } : null,
    };

    console.log('\nInitial Balances:');
    console.log(`  Seller Balance: ₹${initialState.seller.balance}`);
    console.log(`  Delivery Boy Balance: ₹${initialState.deliveryBoy.balance}`);
    console.log(`  Delivery Boy Pending Payout: ₹${initialState.deliveryBoy.pendingAdminPayout}`);
    if (initialState.platform) {
        console.log(`  Platform Total Earning: ₹${initialState.platform.totalPlatformEarning}`);
        console.log(`  Platform Admin Earning: ₹${initialState.platform.totalAdminEarning}`);
    }

    return initialState;
}

async function createTestOrder(users) {
    log.section('STEP 3: Creating Test COD Order');

    const { customer, seller, deliveryBoy, product } = users;

    const Order = mongoose.model('Order');
    const OrderItem = mongoose.model('OrderItem');
    const AppSettings = mongoose.model('AppSettings');

    // Get settings for fees
    const settings = await AppSettings.findOne();
    const platformFeePercent = settings?.platformFee || 3;
    const deliveryCharge = 30; // Fixed for testing

    const productPrice = product.price;
    const platformFee = Math.round((productPrice * platformFeePercent) / 100);
    const subtotal = productPrice;
    const total = subtotal + platformFee + deliveryCharge;

    console.log('DEBUG - Order Values:', {
        subtotal,
        platformFee,
        deliveryCharge,
        total,
        productPrice
    });

    // Create order
    const order = await Order.create({
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email || 'test@example.com',
        customerPhone: customer.phone,
        items: [],
        subtotal,
        platformFee,
        shipping: deliveryCharge,
        total,
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        status: 'Received',
        deliveryAddress: {
            address: 'Test Address',
            city: 'Test City',
            state: 'Test State',
            pincode: '123456',
            latitude: '28.7041',
            longitude: '77.1025',
        },
        deliveryBoy: deliveryBoy._id,
        deliveryDistanceKm: 2,
    });

    // Create order item
    const commissionRate = 10; // 10% default
    const orderItem = await OrderItem.create({
        order: order._id,
        product: product._id,
        productName: product.productName,
        productImage: product.mainImage || '',
        seller: seller._id,
        quantity: 1,
        unitPrice: productPrice,
        total: productPrice,
        subtotal: productPrice,
        commissionRate,
        commissionAmount: (productPrice * commissionRate) / 100,
        status: 'Pending',
    });

    order.items.push(orderItem._id);
    await order.save();

    log.success(`Order created: ${order.orderNumber}`);
    console.log(`  Product: ${product.productName}`);
    console.log(`  Subtotal: ₹${subtotal}`);
    console.log(`  Platform Fee: ₹${platformFee}`);
    console.log(`  Delivery Charge: ₹${deliveryCharge}`);
    console.log(`  Total: ₹${total}`);
    console.log(`  Payment Method: COD`);

    return { order, orderItem, breakdown: { subtotal, platformFee, deliveryCharge, total } };
}

async function markOrderAsDelivered(order) {
    log.section('STEP 4: Marking Order as Delivered');

    const Delivery = mongoose.model('Delivery');

    // Get delivery boy before
    const deliveryBoyBefore = await Delivery.findById(order.deliveryBoy);
    console.log('\nBefore Delivery:');
    console.log(`  Balance: ₹${deliveryBoyBefore.balance}`);
    console.log(`  Pending Admin Payout: ₹${deliveryBoyBefore.pendingAdminPayout}`);
    console.log(`  Cash Collected: ₹${deliveryBoyBefore.cashCollected}`);

    // Import and call processCODOrderDelivery
    const { processCODOrderDelivery, calculateCODOrderBreakdown } = require('./dist/services/commissionService');

    log.info('Calculating COD breakdown...');
    const breakdown = await calculateCODOrderBreakdown(order._id.toString());

    console.log('\nCOD Breakdown:');
    console.log(`  Product Cost: ₹${breakdown.productCost}`);
    console.log(`  Admin Product Commission: ₹${breakdown.adminProductCommission}`);
    console.log(`  Platform Fee: ₹${breakdown.platformFee}`);
    console.log(`  Delivery Charge: ₹${breakdown.totalDeliveryCharge}`);
    console.log(`  Delivery Boy Commission: ₹${breakdown.deliveryBoyCommission}`);
    console.log(`  Admin Delivery Commission: ₹${breakdown.adminDeliveryCommission}`);
    console.log(`  Total Admin Earning: ₹${breakdown.totalAdminEarning}`);
    console.log(`  Delivery Boy Owes Admin: ₹${breakdown.amountDeliveryBoyOwesAdmin}`);

    log.info('Processing COD order delivery...');
    await processCODOrderDelivery(order._id.toString());

    // Update order status
    order.status = 'Delivered';
    order.deliveryBoyStatus = 'Delivered';
    order.deliveredAt = new Date();
    order.paymentStatus = 'Paid';
    await order.save();

    // Get delivery boy after
    const deliveryBoyAfter = await Delivery.findById(order.deliveryBoy);
    console.log('\nAfter Delivery:');
    console.log(`  Balance: ₹${deliveryBoyAfter.balance} (+${deliveryBoyAfter.balance - deliveryBoyBefore.balance})`);
    console.log(`  Pending Admin Payout: ₹${deliveryBoyAfter.pendingAdminPayout} (+${deliveryBoyAfter.pendingAdminPayout - deliveryBoyBefore.pendingAdminPayout})`);
    console.log(`  Cash Collected: ₹${deliveryBoyAfter.cashCollected} (+${deliveryBoyAfter.cashCollected - deliveryBoyBefore.cashCollected})`);

    // Verify
    if (deliveryBoyAfter.balance === deliveryBoyBefore.balance + breakdown.deliveryBoyCommission) {
        log.success('Delivery boy balance updated correctly');
    } else {
        log.error(`Delivery boy balance mismatch! Expected: ${deliveryBoyBefore.balance + breakdown.deliveryBoyCommission}, Got: ${deliveryBoyAfter.balance}`);
    }

    if (deliveryBoyAfter.pendingAdminPayout === deliveryBoyBefore.pendingAdminPayout + breakdown.amountDeliveryBoyOwesAdmin) {
        log.success('Delivery boy pending payout updated correctly');
    } else {
        log.error(`Pending payout mismatch! Expected: ${deliveryBoyBefore.pendingAdminPayout + breakdown.amountDeliveryBoyOwesAdmin}, Got: ${deliveryBoyAfter.pendingAdminPayout}`);
    }

    return breakdown;
}

async function simulatePayToAdmin(order, breakdown) {
    log.section('STEP 5: Simulating Pay to Admin');

    const Delivery = mongoose.model('Delivery');
    const Seller = mongoose.model('Seller');
    const PlatformWallet = mongoose.model('PlatformWallet');
    const OrderItem = mongoose.model('OrderItem');

    const deliveryBoy = await Delivery.findById(order.deliveryBoy);
    const amountToPay = breakdown.amountDeliveryBoyOwesAdmin;

    console.log(`\nAmount to pay: ₹${amountToPay}`);

    // Get states before
    const platformBefore = await PlatformWallet.findOne();
    const orderItem = await OrderItem.findOne({ order: order._id });
    const sellerBefore = await Seller.findById(orderItem.seller);

    console.log('\nBefore Payment:');
    console.log(`  Delivery Boy Pending: ₹${deliveryBoy.pendingAdminPayout}`);
    console.log(`  Seller Balance: ₹${sellerBefore.balance}`);
    if (platformBefore) {
        console.log(`  Platform Total Earning: ₹${platformBefore.totalPlatformEarning}`);
        console.log(`  Platform Admin Earning: ₹${platformBefore.totalAdminEarning}`);
    }

    // Simulate payment
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { processPendingCODPayouts } = require('./dist/services/commissionService');

        // Update delivery boy
        deliveryBoy.pendingAdminPayout = Math.max(0, deliveryBoy.pendingAdminPayout - amountToPay);
        await deliveryBoy.save({ session });

        // Update platform wallet
        let platformWallet = await PlatformWallet.findOne().session(session);
        if (!platformWallet) {
            const walletArray = await PlatformWallet.create([{
                totalPlatformEarning: 0,
                currentPlatformBalance: 0,
                totalAdminEarning: 0,
                pendingFromDeliveryBoy: 0,
                sellerPendingPayouts: 0,
                deliveryBoyPendingPayouts: 0,
            }], { session });
            platformWallet = walletArray[0];
        }

        platformWallet.totalPlatformEarning += amountToPay;
        platformWallet.currentPlatformBalance += amountToPay;
        platformWallet.totalAdminEarning += breakdown.totalAdminEarning;
        platformWallet.pendingFromDeliveryBoy -= amountToPay;

        let totalSellerEarnings = 0;
        for (const earning of breakdown.sellerEarnings.values()) {
            totalSellerEarnings += earning;
        }
        platformWallet.sellerPendingPayouts += totalSellerEarnings;

        await platformWallet.save({ session });

        // Process seller payouts
        await processPendingCODPayouts(deliveryBoy._id.toString(), amountToPay, session);

        await session.commitTransaction();
        log.success('Payment processed successfully');

        // Get states after
        const deliveryBoyAfter = await Delivery.findById(order.deliveryBoy);
        const platformAfter = await PlatformWallet.findOne();
        const sellerAfter = await Seller.findById(orderItem.seller);

        console.log('\nAfter Payment:');
        console.log(`  Delivery Boy Pending: ₹${deliveryBoyAfter.pendingAdminPayout}`);
        console.log(`  Seller Balance: ₹${sellerAfter.balance} (+${sellerAfter.balance - sellerBefore.balance})`);
        console.log(`  Platform Total Earning: ₹${platformAfter.totalPlatformEarning} (+${platformAfter.totalPlatformEarning - (platformBefore?.totalPlatformEarning || 0)})`);
        console.log(`  Platform Admin Earning: ₹${platformAfter.totalAdminEarning} (+${platformAfter.totalAdminEarning - (platformBefore?.totalAdminEarning || 0)})`);

        // Verify
        if (deliveryBoyAfter.pendingAdminPayout === 0) {
            log.success('Delivery boy pending payout cleared');
        } else {
            log.error(`Pending payout not cleared! Still: ₹${deliveryBoyAfter.pendingAdminPayout}`);
        }

        const expectedSellerEarning = breakdown.productCost - breakdown.adminProductCommission;
        if (sellerAfter.balance === sellerBefore.balance + expectedSellerEarning) {
            log.success('Seller received correct amount');
        } else {
            log.error(`Seller amount mismatch! Expected: +₹${expectedSellerEarning}, Got: +₹${sellerAfter.balance - sellerBefore.balance}`);
        }

    } catch (error) {
        await session.abortTransaction();
        log.error(`Payment processing failed: ${error.message}`);
        throw error;
    } finally {
        session.endSession();
    }
}

async function verifyFinalState(initialState, breakdown, users) {
    log.section('STEP 6: Final Verification');

    const Seller = mongoose.model('Seller');
    const Delivery = mongoose.model('Delivery');
    const PlatformWallet = mongoose.model('PlatformWallet');

    const sellerMobile = users.seller.mobile;
    const deliveryBoyMobile = users.deliveryBoy.mobile;

    const seller = await Seller.findOne({ mobile: sellerMobile });
    const deliveryBoy = await Delivery.findOne({ mobile: deliveryBoyMobile });
    const platformWallet = await PlatformWallet.findOne();

    console.log('DEBUG - Final Verification Seller ID:', seller._id);
    console.log('DEBUG - Final Verification Seller Balance:', seller.balance);
    console.log('DEBUG - Initial State Seller Balance:', initialState.seller.balance);
    console.log('DEBUG - Breakdown Product Cost:', breakdown.productCost);
    console.log('DEBUG - Breakdown Admin Comm:', breakdown.adminProductCommission);

    let allPassed = true;

    // Check delivery boy
    const expectedDeliveryBalance = initialState.deliveryBoy.balance + breakdown.deliveryBoyCommission;
    if (Math.abs(deliveryBoy.balance - expectedDeliveryBalance) < 0.1) {
        log.success(`Delivery Boy Balance: ₹${deliveryBoy.balance} ✓`);
    } else {
        log.error(`Delivery Boy Balance: Expected ₹${expectedDeliveryBalance}, Got ₹${deliveryBoy.balance}`);
        allPassed = false;
    }

    if (Math.abs(deliveryBoy.pendingAdminPayout - initialState.deliveryBoy.pendingAdminPayout) < 0.1) {
        log.success(`Delivery Boy Pending: ₹${deliveryBoy.pendingAdminPayout} ✓`);
    } else {
        log.error(`Delivery Boy Pending: Expected ₹${initialState.deliveryBoy.pendingAdminPayout}, Got ₹${deliveryBoy.pendingAdminPayout}`);
        allPassed = false;
    }

    // Check seller
    const expectedSellerBalance = initialState.seller.balance + (breakdown.productCost - breakdown.adminProductCommission);
    if (Math.abs(seller.balance - expectedSellerBalance) < 0.1) {
        log.success(`Seller Balance: ₹${seller.balance} ✓`);
    } else {
        log.error(`Seller Balance: Expected ₹${expectedSellerBalance}, Got ₹${seller.balance}`);
        allPassed = false;
    }

    // Check platform
    if (platformWallet) {
        const expectedAdminEarning = (initialState.platform?.totalAdminEarning || 0) + breakdown.totalAdminEarning;
        if (platformWallet.totalAdminEarning === expectedAdminEarning) {
            log.success(`Platform Admin Earning: ₹${platformWallet.totalAdminEarning} ✓`);
        } else {
            log.error(`Platform Admin Earning: Expected ₹${expectedAdminEarning}, Got ₹${platformWallet.totalAdminEarning}`);
            allPassed = false;
        }
    }

    return allPassed;
}

async function cleanup() {
    log.section('STEP 7: Cleanup (Optional)');
    log.warn('Skipping cleanup - keeping test data for manual verification');
    log.info('To reset, run the cleanup queries from the testing guide');
}

async function runTest() {
    try {
        log.section('🚀 COD PAYMENT FLOW TEST');

        const connected = await connectDB();
        if (!connected) {
            process.exit(1);
        }

        const users = await findTestUsers();
        if (!users) {
            log.error('Test users not found. Please ensure test data exists.');
            process.exit(1);
        }

        const initialState = await captureInitialState(users);

        const { order, breakdown: orderBreakdown } = await createTestOrder(users);

        const codBreakdown = await markOrderAsDelivered(order);

        await simulatePayToAdmin(order, codBreakdown);

        const allPassed = await verifyFinalState(initialState, codBreakdown, users);

        if (allPassed) {
            log.section('✅ ALL TESTS PASSED!');
            console.log('\nThe COD payment flow is working correctly!');
        } else {
            log.section('❌ SOME TESTS FAILED');
            console.log('\nPlease check the errors above and review the implementation.');
        }

    } catch (error) {
        log.error(`Test failed with error: ${error.message}`);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        log.info('Disconnected from MongoDB');
    }
}

// Run the test
runTest();
