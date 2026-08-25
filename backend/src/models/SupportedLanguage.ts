import mongoose, { Schema, Document } from "mongoose";

export interface ISupportedLanguage extends Document {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SupportedLanguageSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nativeName: {
      type: String,
      required: true,
      trim: true,
    },
    flag: {
      type: String,
      default: "🌐",
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

SupportedLanguageSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.model<ISupportedLanguage>(
  "SupportedLanguage",
  SupportedLanguageSchema
);
