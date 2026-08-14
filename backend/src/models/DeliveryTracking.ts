import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryTracking extends Document {
  order: mongoose.Types.ObjectId;
  deliveryBoy: mongoose.Types.ObjectId;

  // Current Location
  currentLocation: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };

  // Legacy fields (keeping for backwards compatibility)
  latitude: number;
  longitude: number;
  address?: string;

  // Route history
  route: Array<{ lat: number; lng: number }>;

  // Estimates
  eta: number; // minutes
  distance: number; // meters

  // Status
  status: 'idle' | 'picked_up' | 'in_transit' | 'nearby' | 'delivered';
  notes?: string;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateDistance(targetLat: number, targetLng: number): number;
  calculateETA(distance: number): number;
}

const DeliveryTrackingSchema = new Schema<IDeliveryTracking>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: [true, "Delivery boy is required"],
    },

    // Current location tracking
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      timestamp: { type: Date, default: Date.now },
    },

    // Legacy fields
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
    },
    address: {
      type: String,
      trim: true,
    },

    // Route tracking
    route: [{
      lat: { type: Number },
      lng: { type: Number },
      _id: false,
    }],

    // Estimates
    eta: {
      type: Number,
      default: 30,
    },
    distance: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ['idle', 'picked_up', 'in_transit', 'nearby', 'delivered'],
      default: 'idle',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeliveryTrackingSchema.index({ order: 1, createdAt: -1 });
DeliveryTrackingSchema.index({ deliveryBoy: 1 });

// Method to calculate distance (Haversine formula)
DeliveryTrackingSchema.methods.calculateDistance = function (
  targetLat: number,
  targetLng: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const lat = this.currentLocation?.latitude || this.latitude;
  const lng = this.currentLocation?.longitude || this.longitude;

  const φ1 = (lat * Math.PI) / 180;
  const φ2 = (targetLat * Math.PI) / 180;
  const Δφ = ((targetLat - lat) * Math.PI) / 180;
  const Δλ = ((targetLng - lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Method to estimate ETA (assuming 30 km/h average speed)
DeliveryTrackingSchema.methods.calculateETA = function (distance: number): number {
  const averageSpeedKmh = 30;
  const averageSpeedMs = (averageSpeedKmh * 1000) / 60; // meters per minute
  return Math.ceil(distance / averageSpeedMs);
};

const DeliveryTracking = (mongoose.models.DeliveryTracking as mongoose.Model<IDeliveryTracking>) || mongoose.model<IDeliveryTracking>(
  "DeliveryTracking",
  DeliveryTrackingSchema
);

export default DeliveryTracking;
