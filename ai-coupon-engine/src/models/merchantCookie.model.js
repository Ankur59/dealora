import mongoose, { Schema, model } from "mongoose";

/**
 * MerchantCookie
 * Stores the raw browser cookie session captured by the internal
 * Dealora Cookie Sync Chrome extension.
 *
 * Fields
 * ──────
 * merchantName  : label entered by the employee in the extension
 * merchantUrl   : the tab URL at the time of sync (e.g. https://www.amazon.in/)
 * cookiesCount  : quick reference count without parsing the array
 * cookies       : raw cookie objects as returned by chrome.cookies.getAll()
 * syncedAt      : ISO timestamp from the browser at the moment of capture
 * createdAt / updatedAt : managed by Mongoose { timestamps: true }
 */
const merchantCookieSchema = new Schema(
    {
        merchantName: {
            type: String,
            required: [true, "Merchant name is required"],
            trim: true,
        },
        merchantUrl: {
            type: String,
            trim: true,
            default: "",
        },
        cookiesCount: {
            type: Number,
            default: 0,
        },
        cookies: {
            type: Schema.Types.Mixed, // array of raw chrome cookie objects
            default: [],
        },
        syncedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true, // adds createdAt + updatedAt automatically
        collection: "merchant_cookies",
    }
);

// Index for fast lookup by merchant name
merchantCookieSchema.index({ merchantName: 1 });
merchantCookieSchema.index({ createdAt: -1 });

const MerchantCookie = model("MerchantCookie", merchantCookieSchema);

export default MerchantCookie;
