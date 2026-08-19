import mongoose, { Schema, Document } from "mongoose";

export interface ICustomerSupportRequest extends Document {
  customer?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "Pending" | "In Progress" | "Resolved";
  emailSent: boolean;
  emailMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSupportRequestSchema: Schema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailMessageId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ICustomerSupportRequest>(
  "CustomerSupportRequest",
  CustomerSupportRequestSchema
);
