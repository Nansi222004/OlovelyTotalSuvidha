import mongoose, { Document, Schema } from "mongoose";

export interface IAppSettings extends Document {
  // App Info
  appName: string;
  appLogo?: string;
  appFavicon?: string;
  estimatedDeliveryTime?: string;

  // Contact Info
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;

  // Address
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyPincode?: string;
  companyCountry?: string;

  // Payment Settings
  paymentMethods: {
    cod: boolean;
    online: boolean;
    wallet: boolean;
    upi: boolean;
  };
  paymentGateways?: {
    razorpay?: {
      enabled: boolean;
      keyId?: string;
      keySecret?: string;
    };
    stripe?: {
      enabled: boolean;
      publishableKey?: string;
      secretKey?: string;
    };
  };

  // SMS Gateway Settings
  smsGateway?: {
    provider: string; // e.g., 'Twilio', 'MSG91', 'TextLocal'
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    enabled: boolean;
  };

  // Commission Settings
  globalCommissionRate?: number;


  // Delivery Settings
  platformFee?: number;
  deliveryCharges: number;
  freeDeliveryThreshold?: number;
  /** Cart subtotal must be at least this amount to place an order. 0 = no minimum. */
  minimumOrderValue?: number;
  deliveryConfig?: {
    isDistanceBased: boolean;
    googleMapsKey?: string;
    baseCharge: number;
    baseDistance: number;
    kmRate: number;
    deliveryBoyKmRate?: number;
  };

  // Tax Settings
  gstEnabled: boolean;
  gstRate?: number;

  // Policies
  privacyPolicy?: string;
  termsOfService?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  customerAppPolicy?: string;
  deliveryAppPolicy?: string;

  returnConfig?: {
    returnsEnabled: boolean;
    defaultReturnWindowDays: number;
    autoApproveReturns?: boolean;
  };

  // FAQ
  faq?: Array<{
    question: string;
    answer: string;
  }>;

  // Home Sections Configuration
  homeSections?: Array<{
    title: string;
    category?: mongoose.Types.ObjectId;
    subcategory?: mongoose.Types.ObjectId;
    city?: string;
    deliverableArea?: string;
    status: string;
    productSortBy?: string;
    productLimit?: number;
    order: number;
  }>;

  // Feature Flags
  features: {
    sellerRegistration: boolean;
    productApproval: boolean;
    orderTracking: boolean;
    wallet: boolean;
    coupons: boolean;
    showSellerDetails: boolean;
  };

  // Maintenance Mode
  maintenanceMode: boolean;
  maintenanceMessage?: string;

  // Updated By
  updatedBy?: mongoose.Types.ObjectId;

  // Withdrawal Settings
  minimumWithdrawalAmount?: number;

  createdAt: Date;
  updatedAt: Date;
}

// Define the Model type with static methods
interface IAppSettingsModel extends mongoose.Model<IAppSettings> {
  getSettings(): Promise<IAppSettings>;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    // ... (rest of schema is fine, just adding new field)

    // Withdrawal Settings
    minimumWithdrawalAmount: {
      type: Number,
      default: 100
    },

    // App Info
    appName: {
      type: String,
      default: "Olovely Total Suvidha",
      trim: true,
    },
    appLogo: {
      type: String,
      default: "/assets/olovelylogo_transparent.png",
      trim: true,
    },
    appFavicon: {
      type: String,
      trim: true,
    },
    estimatedDeliveryTime: {
      type: String,
      default: "12-15 mins",
      trim: true,
    },

    // Contact Info
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
    },
    supportEmail: {
      type: String,
      trim: true,
    },
    supportPhone: {
      type: String,
      trim: true,
    },

    // Address
    companyAddress: {
      type: String,
      trim: true,
    },
    companyCity: {
      type: String,
      trim: true,
    },
    companyState: {
      type: String,
      trim: true,
    },
    companyPincode: {
      type: String,
      trim: true,
    },
    companyCountry: {
      type: String,
      default: "India",
      trim: true,
    },

    // Payment Settings
    paymentMethods: {
      cod: {
        type: Boolean,
        default: true,
      },
      online: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      upi: {
        type: Boolean,
        default: true,
      },
    },
    paymentGateways: {
      razorpay: {
        enabled: Boolean,
        keyId: String,
        keySecret: String,
      },
      stripe: {
        enabled: Boolean,
        publishableKey: String,
        secretKey: String,
      },
    },

    // SMS Gateway Settings
    smsGateway: {
      provider: {
        type: String,
        trim: true,
      },
      apiKey: {
        type: String,
        trim: true,
      },
      apiSecret: {
        type: String,
        trim: true,
      },
      senderId: {
        type: String,
        trim: true,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // Commission Settings
    globalCommissionRate: {
      type: Number,
      default: 10,
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },


    // Delivery Settings
    platformFee: {
      type: Number,
      default: 2,
      min: [0, "Platform fee cannot be negative"],
    },
    deliveryCharges: {
      type: Number,
      default: 0,
      min: [0, "Delivery charges cannot be negative"],
    },
    freeDeliveryThreshold: {
      type: Number,
      min: [0, "Free delivery threshold cannot be negative"],
    },
    minimumOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },
    deliveryConfig: {
      isDistanceBased: { type: Boolean, default: false },
      googleMapsKey: { type: String, trim: true },
      baseCharge: { type: Number, default: 0 },
      baseDistance: { type: Number, default: 0 },
      kmRate: { type: Number, default: 0 },
      deliveryBoyKmRate: { type: Number, default: 0 },
    },
    // Tax Settings
    gstEnabled: {
      type: Boolean,
      default: false,
    },
    gstRate: {
      type: Number,
      min: [0, "GST rate cannot be negative"],
      max: [100, "GST rate cannot exceed 100%"],
    },

    // Policies
    privacyPolicy: {
      type: String,
      trim: true,
    },
    termsOfService: {
      type: String,
      trim: true,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
    refundPolicy: {
      type: String,
      trim: true,
    },
    customerAppPolicy: {
      type: String,
      trim: true,
    },
    deliveryAppPolicy: {
      type: String,
      trim: true,
    },
    returnConfig: {
      returnsEnabled: { type: Boolean, default: true },
      defaultReturnWindowDays: { type: Number, default: 7, min: 0 },
      autoApproveReturns: { type: Boolean, default: false },
    },

    // FAQ
    faq: [
      {
        question: {
          type: String,
          required: true,
          trim: true,
        },
        answer: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    // Home Sections Configuration
    homeSections: [
      {
        title: String,
        category: {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
        subcategory: {
          type: Schema.Types.ObjectId,
          ref: "SubCategory",
        },
        city: String,
        deliverableArea: String,
        status: String,
        productSortBy: String,
        productLimit: Number,
        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Feature Flags
    features: {
      sellerRegistration: {
        type: Boolean,
        default: true,
      },
      productApproval: {
        type: Boolean,
        default: true,
      },
      orderTracking: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      coupons: {
        type: Boolean,
        default: true,
      },
      showSellerDetails: {
        type: Boolean,
        default: true,
      },
    },

    // Maintenance Mode
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      trim: true,
    },

    // Updated By
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one settings document exists
AppSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      appName: "Olovely Total Suvidha",
      appLogo: "/assets/olovelylogo_transparent.png",
      estimatedDeliveryTime: "12-15 mins",
      contactEmail: "contact@olovely.com",
      contactPhone: "9876543210",
    });
  }
  return settings;
};

// Indexes
AppSettingsSchema.index({ appName: 1 });

const AppSettings = (mongoose.models.AppSettings as IAppSettingsModel) || mongoose.model<IAppSettings, IAppSettingsModel>(
  "AppSettings",
  AppSettingsSchema,
);

export default AppSettings;
