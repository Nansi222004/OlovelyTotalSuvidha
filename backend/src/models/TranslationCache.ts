import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITranslationCache extends Document {
  sourceHash: string;
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  translatedText: string;
  createdAt: Date;
  updatedAt: Date;
}

const TranslationCacheSchema = new Schema<ITranslationCache>(
  {
    sourceHash: {
      type: String,
      required: true,
      index: true,
    },
    sourceText: {
      type: String,
      required: true,
    },
    sourceLang: {
      type: String,
      default: "en",
      index: true,
    },
    targetLang: {
      type: String,
      required: true,
      index: true,
    },
    translatedText: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on sourceHash + targetLang + sourceLang
TranslationCacheSchema.index({ sourceHash: 1, targetLang: 1, sourceLang: 1 }, { unique: true });

const TranslationCache: Model<ITranslationCache> =
  (mongoose.models.TranslationCache as Model<ITranslationCache>) ||
  mongoose.model<ITranslationCache>("TranslationCache", TranslationCacheSchema);

export default TranslationCache;
