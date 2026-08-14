import mongoose, { Document, Schema } from 'mongoose';

export type UserType = 'Admin' | 'Seller' | 'Customer' | 'Delivery';

export interface IOtp extends Document {
  mobile: string;
  otp: string;
  userType: UserType;
  expiresAt: Date;
  isVerified: boolean;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Mobile number must be 10 digits',
      },
    },
    otp: {
      type: String,
      required: [true, 'OTP is required'],
      trim: true,
    },
    userType: {
      type: String,
      required: [true, 'User type is required'],
      enum: ['Admin', 'Seller', 'Customer', 'Delivery'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookup
OtpSchema.index({ mobile: 1, userType: 1 });

const Otp = (mongoose.models.Otp as mongoose.Model<IOtp>) || mongoose.model<IOtp>('Otp', OtpSchema);

export default Otp;

