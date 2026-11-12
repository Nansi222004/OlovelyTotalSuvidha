import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawRequest extends Document {
    userId: mongoose.Types.ObjectId; // Generic user reference (seller or delivery boy)
    userType: 'SELLER' | 'DELIVERY_BOY'; // Type of user
    amount: number;
    /** R-11: amount reserved on the user (pendingWithdrawalAmount) when requested. 0 for legacy requests. */
    reservedAmount?: number;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    paymentMethod: 'Bank Transfer' | 'UPI';
    accountDetails: string;
    upiId?: string;
    remarks?: string;
    processedBy?: mongoose.Types.ObjectId; // Admin who processed the request
    processedAt?: Date; // When the request was processed
    transactionReference?: string; // Bank transaction reference after completion
    createdAt: Date;
    updatedAt: Date;
}

const WithdrawRequestSchema = new Schema<IWithdrawRequest>(
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
            min: [1, 'Minimum withdrawal amount is 1'],
        },
        reservedAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
            default: 'Pending',
        },
        paymentMethod: {
            type: String,
            enum: ['Bank Transfer', 'UPI'],
            required: [true, 'Payment method is required'],
        },
        accountDetails: {
            type: String,
            required: [true, 'Account details are required'],
            trim: true,
        },
        upiId: {
            type: String,
            trim: true,
        },
        remarks: {
            type: String,
            trim: true,
        },
        processedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
        },
        processedAt: {
            type: Date,
        },
        transactionReference: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

WithdrawRequestSchema.index({ userId: 1, userType: 1 });
WithdrawRequestSchema.index({ status: 1 });
WithdrawRequestSchema.index({ createdAt: -1 });

const WithdrawRequest = mongoose.models.WithdrawRequest || mongoose.model<IWithdrawRequest>('WithdrawRequest', WithdrawRequestSchema);

export default WithdrawRequest;
