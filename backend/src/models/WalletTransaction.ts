import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletTransaction extends Document {
    userId: mongoose.Types.ObjectId; // Generic user reference (seller, delivery boy, or customer)
    userType: 'SELLER' | 'DELIVERY_BOY' | 'CUSTOMER'; // Type of user
    category?: 'COD_RETURN_REFUND' | 'ORDER_CANCELLATION_REFUND' | 'ORDER_PAYMENT' | 'MANUAL_ADMIN_CREDIT' | 'MANUAL_ADMIN_DEBIT';
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    type: 'Credit' | 'Debit';
    description: string;
    status: 'Completed' | 'Pending' | 'Failed';
    reference: string;
    relatedOrder?: mongoose.Types.ObjectId; // Reference to order
    relatedCommission?: mongoose.Types.ObjectId; // Reference to commission record
    relatedReturn?: mongoose.Types.ObjectId; // Reference to return record
    createdAt: Date;
    updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            refPath: 'userType',
            required: [true, 'User ID is required'],
        },
        userType: {
            type: String,
            enum: ['SELLER', 'DELIVERY_BOY', 'CUSTOMER'],
            required: [true, 'User type is required'],
        },
        category: {
            type: String,
            enum: ['COD_RETURN_REFUND', 'ORDER_CANCELLATION_REFUND', 'ORDER_PAYMENT', 'MANUAL_ADMIN_CREDIT', 'MANUAL_ADMIN_DEBIT'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        balanceBefore: {
            type: Number,
        },
        balanceAfter: {
            type: Number,
        },
        type: {
            type: String,
            enum: ['Credit', 'Debit'],
            required: [true, 'Transaction type is required'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['Completed', 'Pending', 'Failed'],
            default: 'Completed',
        },
        reference: {
            type: String,
            unique: true,
            required: [true, 'Reference ID is required'],
        },
        relatedOrder: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
        },
        relatedCommission: {
            type: Schema.Types.ObjectId,
            ref: 'Commission',
        },
        relatedReturn: {
            type: Schema.Types.ObjectId,
            ref: 'Return',
        },
    },
    {
        timestamps: true,
    }
);

WalletTransactionSchema.index({ userId: 1, userType: 1 });
WalletTransactionSchema.index({ createdAt: -1 });
WalletTransactionSchema.index({ relatedOrder: 1 });
WalletTransactionSchema.index({ userId: 1, userType: 1, relatedOrder: 1, type: 1 });

const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;
