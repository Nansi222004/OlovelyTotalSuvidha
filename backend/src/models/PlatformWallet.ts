import mongoose, { Document, Schema } from "mongoose";

export interface IPlatformWallet extends Document {
    // Total Platform Earnings - All money collected from orders
    totalPlatformEarning: number;

    // Current Platform Balance - Money available after payouts to sellers/delivery boys
    currentPlatformBalance: number;

    // Total Admin Earnings - Admin's commission (product commission + delivery commission + platform fee)
    totalAdminEarning: number;

    // Pending from Delivery Boys - Total COD amount that delivery boys need to pay
    pendingFromDeliveryBoy: number;

    // Seller Pending Payouts - Total amount owed to sellers (their balance)
    sellerPendingPayouts: number;

    // Delivery Boy Pending Payouts - Total amount owed to delivery boys (their balance)
    deliveryBoyPendingPayouts: number;

    createdAt: Date;
    updatedAt: Date;
}

// Define the Model type with static methods
interface IPlatformWalletModel extends mongoose.Model<IPlatformWallet, {}, {}> {
    getWallet(): Promise<IPlatformWallet>;
    updateWallet(updates: Partial<IPlatformWallet>): Promise<IPlatformWallet>;
}

const PlatformWalletSchema = new Schema<IPlatformWallet, IPlatformWalletModel>(
    {
        totalPlatformEarning: {
            type: Number,
            default: 0,
            min: [0, "Total platform earning cannot be negative"],
        },
        currentPlatformBalance: {
            type: Number,
            default: 0,
            min: [0, "Current platform balance cannot be negative"],
        },
        totalAdminEarning: {
            type: Number,
            default: 0,
            min: [0, "Total admin earning cannot be negative"],
        },
        pendingFromDeliveryBoy: {
            type: Number,
            default: 0,
            min: [0, "Pending from delivery boy cannot be negative"],
        },
        sellerPendingPayouts: {
            type: Number,
            default: 0,
            min: [0, "Seller pending payouts cannot be negative"],
        },
        deliveryBoyPendingPayouts: {
            type: Number,
            default: 0,
            min: [0, "Delivery boy pending payouts cannot be negative"],
        },
    },
    {
        timestamps: true,
    }
);

// Static method to get or create the single platform wallet instance
PlatformWalletSchema.statics.getWallet = async function () {
    let wallet = await this.findOne();
    if (!wallet) {
        wallet = await this.create({
            totalPlatformEarning: 0,
            currentPlatformBalance: 0,
            totalAdminEarning: 0,
            pendingFromDeliveryBoy: 0,
            sellerPendingPayouts: 0,
            deliveryBoyPendingPayouts: 0,
        });
    }
    return wallet;
};

// Static method to update wallet with atomic operations
PlatformWalletSchema.statics.updateWallet = async function (
    updates: Partial<IPlatformWallet>
) {
    const wallet = await (this as any).getWallet();
    Object.assign(wallet, updates);
    await wallet.save();
    return wallet;
};

// Indexes
PlatformWalletSchema.index({ createdAt: 1 });

const PlatformWallet =
    (mongoose.models.PlatformWallet as IPlatformWalletModel) ||
    mongoose.model<IPlatformWallet, IPlatformWalletModel>(
        "PlatformWallet",
        PlatformWalletSchema
    );

export default PlatformWallet;
