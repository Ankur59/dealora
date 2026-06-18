import { Schema, model } from 'mongoose';

/**
 * BrandTag
 *
 * Stores our hand-curated tag lists for each brand (seeded from tags.js).
 * At coupon-normalise time the adapter fetches this collection into memory
 * and merges these custom tags with the API's category_names — deduped.
 *
 * Unique key: brandName (lowercase)
 * Collection:  brandtags
 */
const brandTagSchema = new Schema(
    {
        /** Lowercase brand / merchant name — matches coupon.brandName */
        brandName: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },

        /** Curated tag strings — all lowercase */
        tags: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

brandTagSchema.index({ brandName: 1 }, { unique: true });

const BrandTag = model('brandtag', brandTagSchema);
export default BrandTag;
