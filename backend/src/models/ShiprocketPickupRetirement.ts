import mongoose, { Document, Schema } from 'mongoose';

export interface IShiprocketPickupRetirement extends Document {
  sellerId: mongoose.Types.ObjectId;
  pickupLocationId?: string;
  pickupLocationName: string;
  addressFingerprint?: string;
  retiredAt: Date;
  remoteRemovalSupported: false;
  reason: 'SELLER_DELETED';
}

const ShiprocketPickupRetirementSchema = new Schema<IShiprocketPickupRetirement>(
  {
    sellerId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    pickupLocationId: { type: String, trim: true },
    pickupLocationName: { type: String, required: true, trim: true },
    addressFingerprint: { type: String, trim: true },
    retiredAt: { type: Date, required: true },
    remoteRemovalSupported: { type: Boolean, required: true, default: false },
    reason: { type: String, required: true, enum: ['SELLER_DELETED'] },
  },
  { timestamps: true }
);

export default (mongoose.models.ShiprocketPickupRetirement as mongoose.Model<IShiprocketPickupRetirement>) ||
  mongoose.model<IShiprocketPickupRetirement>('ShiprocketPickupRetirement', ShiprocketPickupRetirementSchema);
