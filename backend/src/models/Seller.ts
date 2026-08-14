import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface ISeller extends Document {
  // Authentication
  sellerName: string;
  password: string;
  email: string;
  mobile: string;

  // Store Info
  storeName: string;
  panCard?: string;
  category: string;
  taxName?: string;
  address: string;
  taxNumber?: string;
  storeDescription?: string;
  storeBanner?: string;
  fssaiLicNo?: string;
  workingHours?: {
    open: string;
    close: string;
    offDays: string[];
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };

  // Store Location Info
  city: string;
  serviceableArea?: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  // GeoJSON location for geospatial queries
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  // Service radius in kilometers
  serviceRadiusKm?: number;

  // Payment Details
  accountName?: string;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  ifsc?: string;

  // Documents (URLs pointing to cloud storage)
  profile?: string;
  idProof?: string;
  addressProof?: string;

  // Settings
  requireProductApproval: boolean;
  viewCustomerDetails: boolean;
  commission: number;
  commissionRate?: number; // Individual commission rate (overrides global setting)

  // Per-category commission rates (set by admin per seller per header category)
  categoryCommissions: Array<{
    headerCategory: mongoose.Types.ObjectId;
    commissionRate: number;
  }>;

  // Status
  status: 'Approved' | 'Pending' | 'Rejected';
  balance: number;
  categories: string[];
  logo?: string;
  isShopOpen: boolean;

  createdAt: Date;
  updatedAt: Date;
  // FCM Push Notification Tokens
  fcmTokens?: string[];        // Web push notification tokens
  fcmTokenMobile?: string[];   // Mobile push notification tokens
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const SellerSchema = new Schema<ISeller>(
  {
    // Authentication
    sellerName: {
      type: String,
      required: [true, 'Seller name is required'],
      trim: true,
    },
    password: {
      type: String,
      required: false, // Password not required during signup
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Mobile number must be 10 digits',
      },
    },

    // Store Info
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    panCard: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    taxName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      required: false,
      trim: true,
    },
    taxNumber: {
      type: String,
      trim: true,
    },
    storeDescription: {
      type: String,
      trim: true,
    },
    storeBanner: {
      type: String,
      trim: true,
    },
    fssaiLicNo: {
      type: String,
      trim: true,
    },
    workingHours: {
      open: { type: String },
      close: { type: String },
      offDays: [{ type: String }],
    },
    socialLinks: {
      facebook: { type: String },
      instagram: { type: String },
      twitter: { type: String },
    },

    // Store Location Info
    city: {
      type: String,
      required: false,
      trim: true,
    },
    serviceableArea: {
      type: String,
      trim: true,
    },
    searchLocation: {
      type: String,
      trim: true,
    },
    latitude: {
      type: String,
      trim: true,
    },
    longitude: {
      type: String,
      trim: true,
    },
    // GeoJSON location for geospatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    // Service radius in kilometers (default: 10km if not specified)
    serviceRadiusKm: {
      type: Number,
      default: 10,
      min: [0.1, 'Service radius must be at least 0.1 km'],
      max: [100, 'Service radius cannot exceed 100 km'],
    },

    // Payment Details
    accountName: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    branch: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifsc: {
      type: String,
      trim: true,
    },

    // Documents (URLs)
    profile: {
      type: String,
      trim: true,
    },
    idProof: {
      type: String,
      trim: true,
    },
    addressProof: {
      type: String,
      trim: true,
    },

    // Settings
    requireProductApproval: {
      type: Boolean,
      default: false,
    },
    viewCustomerDetails: {
      type: Boolean,
      default: true,
    },
    commission: {
      type: Number,
      required: [true, 'Commission is required'],
      default: 0,
      min: [0, 'Commission cannot be negative'],
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
    },
    categoryCommissions: [{
      headerCategory: {
        type: Schema.Types.ObjectId,
        ref: 'HeaderCategory',
        required: true,
      },
      commissionRate: {
        type: Number,
        default: 0,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100%'],
      },
    }],

    // Status
    status: {
      type: String,
      enum: ['Approved', 'Pending', 'Rejected'],
      default: 'Pending',
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    categories: {
      type: [String],
      default: [],
    },
    logo: {
      type: String,
      trim: true,
    },
    isShopOpen: {
      type: Boolean,
      default: true,
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

// Hash password before saving (only if password is provided)
SellerSchema.pre('save', async function (next) {
  // Skip password hashing if password is not provided or not modified
  if (!this.isModified('password') || !this.password) {
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
SellerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create geospatial index on location field for efficient queries
SellerSchema.index({ location: '2dsphere' });
SellerSchema.index({ status: 1 }); // Compound index for status + location queries

const Seller = (mongoose.models.Seller as mongoose.Model<ISeller>) || mongoose.model<ISeller>('Seller', SellerSchema);

// Register Alias for refPath 'SELLER'
if (!(mongoose.models.SELLER as mongoose.Model<ISeller>)) {
  mongoose.model<ISeller>('SELLER', SellerSchema, 'sellers');
}

export default Seller;

