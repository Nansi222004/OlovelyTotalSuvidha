import mongoose, { Document, Schema } from 'mongoose';

export type BannerSection = 'QUICK_COMMERCE' | 'ECOMMERCE' | 'WHOLESALE' | 'ALL';
export type BannerTargetType = 'CATEGORY' | 'PRODUCT' | 'SEARCH' | 'URL' | 'NONE';

export interface IBanner extends Document {
  /** Display title shown on the banner card. */
  title: string;
  /** Optional subtitle / tagline. */
  subtitle?: string;
  /** Desktop/tablet banner image URL. */
  imageUrl?: string;
  /** Mobile-optimised banner image URL (optional). Falls back to imageUrl if absent. */
  mobileImageUrl?: string;

  /** Which homepage section this banner appears in. */
  commerceSection: BannerSection;

  /** Deep-link target type for CTA. */
  targetType: BannerTargetType;
  /** Target ID (CategoryId, ProductId, search term, or raw URL). */
  targetId?: string;

  /** Call-to-action button text. */
  ctaText?: string;

  /** Whether this banner is active. Inactive banners are excluded from customer API. */
  isActive: boolean;

  /** Scheduled display start. If not set, banner is immediately active (when isActive=true). */
  startDate?: Date;
  /** Scheduled display end. Expired banners (endDate < now) are excluded from customer API. */
  endDate?: Date;

  /**
   * Display priority. Higher number = displayed first.
   * Query sort: { priority: -1, createdAt: -1 }.
   */
  priority: number;

  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    mobileImageUrl: {
      type: String,
      trim: true,
    },
    commerceSection: {
      type: String,
      enum: ['QUICK_COMMERCE', 'ECOMMERCE', 'WHOLESALE', 'ALL'],
      default: 'ALL',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['CATEGORY', 'PRODUCT', 'SEARCH', 'URL', 'NONE'],
      default: 'NONE',
    },
    targetId: {
      type: String,
      trim: true,
    },
    ctaText: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for the customer-facing query:
// GET /banners?section=QUICK_COMMERCE → filters isActive, date range, sorts by priority desc
BannerSchema.index({ commerceSection: 1, isActive: 1, priority: -1 });
BannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const Banner =
  (mongoose.models.Banner as mongoose.Model<IBanner>) ||
  mongoose.model<IBanner>('Banner', BannerSchema);

export default Banner;
