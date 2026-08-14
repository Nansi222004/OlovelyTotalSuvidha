
import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlist extends Document {
    customer: mongoose.Types.ObjectId;
    products: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
    {
        customer: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            unique: true,
        },
        products: [{
            type: Schema.Types.ObjectId,
            ref: 'Product'
        }],
    },
    {
        timestamps: true,
    }
);

const Wishlist = (mongoose.models.Wishlist as mongoose.Model<IWishlist>) || mongoose.model<IWishlist>('Wishlist', WishlistSchema);

export default Wishlist;
