import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

export interface IDelivery extends Document {
  // Personal Information
  name: string;
  mobile: string;
  email: string;
  dateOfBirth?: Date;
  password: string;
  address: string;
  city: string;
  pincode?: string;
  profileImage?: string;

  // Documents (URLs pointing to cloud storage)
  drivingLicense?: string;
  nationalIdentityCard?: string;

  // Bank Account Information
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;

  // Vehicle Information
  vehicleNumber?: string;
  vehicleType?: string;

  // Commission & Payment
  bonusType?: string; // 'Fixed' | 'Salaried' | 'Commission Based'
  commissionRate?: number; // Individual commission rate (overrides global setting)
  status: "Active" | "Inactive";
  isOnline: boolean; // Availability status
  available: "Available" | "Not Available"; // String status for UI and filtering
  location?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  balance: number;
  cashCollected: number;
  pendingAdminPayout: number;
  settings: {
    notifications: boolean;
    location: boolean;
    sound: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
  // FCM Push Notification Tokens
  fcmTokens?: string[]; // Web push notification tokens
  fcmTokenMobile?: string[]; // Mobile push notification tokens
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    // Personal Information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Mobile number must be 10 digits",
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    dateOfBirth: {
      type: Date,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    address: {
      type: String,
      required: false,
      trim: true,
    },
    city: {
      type: String,
      required: false,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      trim: true,
    },

    // Documents (URLs)
    drivingLicense: {
      type: String,
      trim: true,
    },
    nationalIdentityCard: {
      type: String,
      trim: true,
    },

    // Bank Account Information
    accountName: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },

    // Vehicle Information
    vehicleNumber: {
      type: String,
      trim: true,
    },
    vehicleType: {
      type: String,
      trim: true,
    },

    // Commission & Payment
    bonusType: {
      type: String,
      trim: true,
    },
    commissionRate: {
      type: Number,
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Inactive", // New delivery partners start as Inactive until approved
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    available: {
      type: String,
      enum: ["Available", "Not Available"],
      default: "Not Available",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },
    cashCollected: {
      type: Number,
      default: 0,
      min: [0, "Cash collected cannot be negative"],
    },
    pendingAdminPayout: {
      type: Number,
      default: 0,
      min: [0, "Pending admin payout cannot be negative"],
    },
    settings: {
      notifications: { type: Boolean, default: true },
      location: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
    },
    // FCM Push Notification Tokens
    fcmTokens: {
      type: [String],
      default: [],
    },
    fcmTokenMobile: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Create geospatial index on location field
DeliverySchema.index({ location: "2dsphere" });

// Hash password before saving
DeliverySchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
DeliverySchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Delivery =
  (mongoose.models.Delivery as mongoose.Model<IDelivery>) ||
  mongoose.model<IDelivery>("Delivery", DeliverySchema, "deliveries");

// Register Alias for refPath 'DELIVERY_BOY'
if (!(mongoose.models.DELIVERY_BOY as mongoose.Model<IDelivery>)) {
  mongoose.model<IDelivery>("DELIVERY_BOY", DeliverySchema, "deliveries");
}

export default Delivery;
