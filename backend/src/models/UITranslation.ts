import mongoose, { Schema, Document } from "mongoose";

export interface IUITranslation extends Document {
  key: string;
  languageCode: string;
  sourceText: string;
  translatedText: string;
  isManual: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UITranslationSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    languageCode: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    sourceText: {
      type: String,
      required: true,
      trim: true,
    },
    translatedText: {
      type: String,
      required: true,
      trim: true,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

UITranslationSchema.index({ key: 1, languageCode: 1 }, { unique: true });
UITranslationSchema.index({ languageCode: 1 });

export default mongoose.model<IUITranslation>(
  "UITranslation",
  UITranslationSchema
);
