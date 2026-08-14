import mongoose, { Schema, model, Document } from "mongoose";

export interface IRole extends Document {
  name: string;
  type: "System" | "Custom";
  permissions: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["System", "Custom"],
      default: "Custom",
    },
    permissions: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Role = mongoose.models.Role || model<IRole>("Role", roleSchema);

export default Role;
