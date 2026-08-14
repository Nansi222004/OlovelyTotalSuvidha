import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  registrationDate: Date;
  status: 'Active' | 'Inactive';
  refCode: string;
  deliveryOtp: string; // Permanent 4-digit OTP for delivery verification
  totalOrders: number;
  totalSpent: number;
  walletAmount: number;
  // Location fields
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  locationUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  donationStats?: {
    totalDonated: number;
    lastDonationDate?: Date;
    impactDescription?: string;
  };
  accountPrivacy?: {
    hideSensitiveItems: boolean;
  };
  // FCM Push Notification Tokens
  fcmTokens?: string[];        // Web push notification tokens
  fcmTokenMobile?: string[];   // Mobile push notification tokens
}


const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Allow empty or valid email format
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Phone number must be 10 digits',
      },
    },
    dateOfBirth: {
      type: Date,
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    refCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    deliveryOtp: {
      type: String,
      trim: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: [0, 'Total orders cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total spent cannot be negative'],
    },
    walletAmount: {
      type: Number,
      default: 0,
      min: [0, 'Wallet amount cannot be negative'],
    },
    // Location fields
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    locationUpdatedAt: {
      type: Date,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    donationStats: {
      totalDonated: { type: Number, default: 0 },
      lastDonationDate: Date,
      impactDescription: String,
    },
    accountPrivacy: {
      hideSensitiveItems: { type: Boolean, default: false },
    },
    // FCM Push Notification Tokens
    fcmTokens: {
      type: [String],
      default: []
    },
    fcmTokenMobile: {
      type: [String],
      default: []
    },
  },

  {
    timestamps: true,
  }
);

// Generate refCode and deliveryOtp before saving if not provided
CustomerSchema.pre('save', async function (next) {
  if (!this.refCode) {
    // Generate a unique refCode (e.g., first 4 letters of name + random 4 chars)
    const namePart = this.name
      .replace(/\s+/g, '')
      .substring(0, 4)
      .toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.refCode = `${namePart}${randomPart}`;
  }
  if (!this.deliveryOtp) {
    // Generate permanent 4-digit delivery OTP
    this.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
  }
  next();
});

const Customer = (mongoose.models.Customer as mongoose.Model<ICustomer>) || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;

