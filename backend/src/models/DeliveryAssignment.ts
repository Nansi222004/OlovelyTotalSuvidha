import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryAssignment extends Document {
  order: mongoose.Types.ObjectId;
  deliveryBoy: mongoose.Types.ObjectId;

  // Assignment Info
  assignedAt: Date;
  assignedBy: mongoose.Types.ObjectId;

  // Status
  status:
  | "Assigned"
  | "Accepted"
  | "Picked Up"
  | "In Transit"
  | "Delivered"
  | "Failed"
  | "Cancelled";

  // Timeline
  acceptedAt?: Date;
  pickedUpAt?: Date;
  inTransitAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;

  // Failure Info
  failureReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
      unique: true, // One assignment per order
    },
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: [true, "Delivery boy is required"],
    },

    // Assignment Info
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "Assigned by is required"],
    },

    // Status
    status: {
      type: String,
      enum: [
        "Assigned",
        "Accepted",
        "Picked Up",
        "In Transit",
        "Delivered",
        "Failed",
        "Cancelled",
      ],
      default: "Assigned",
    },

    // Timeline
    acceptedAt: {
      type: Date,
    },
    pickedUpAt: {
      type: Date,
    },
    inTransitAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },

    // Failure Info
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeliveryAssignmentSchema.index({ deliveryBoy: 1, status: 1 });
DeliveryAssignmentSchema.index({ order: 1 });
DeliveryAssignmentSchema.index({ assignedAt: -1 });

const DeliveryAssignment = mongoose.models.DeliveryAssignment || mongoose.model<IDeliveryAssignment>(
  "DeliveryAssignment",
  DeliveryAssignmentSchema
);

export default DeliveryAssignment;
