import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletTransaction extends Document {
    userId: mongoose.Types.ObjectId; // Generic user reference (seller or delivery boy)
    userType: 'SELLER' | 'DELIVERY_BOY'; // Type of user
    amount: number;
    type: 'Credit' | 'Debit';
    description: string;
    status: 'Completed' | 'Pending' | 'Failed';
    reference: string;
    relatedOrder?: mongoose.Types.ObjectId; // Reference to order (for commission credits)
    relatedCommission?: mongoose.Types.ObjectId; // Reference to commission record
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
            enum: ['SELLER', 'DELIVERY_BOY'],
            required: [true, 'User type is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
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
    },
    {
        timestamps: true,
    }
);

WalletTransactionSchema.index({ userId: 1, userType: 1 });
WalletTransactionSchema.index({ createdAt: -1 });
WalletTransactionSchema.index({ relatedOrder: 1 });

const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;
