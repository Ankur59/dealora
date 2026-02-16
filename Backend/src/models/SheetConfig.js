const mongoose = require('mongoose');

const sheetConfigSchema = new mongoose.Schema(
    {
        sheetUrl: {
            type: String,
            required: [true, 'Sheet URL is required'],
            trim: true,
            validate: {
                validator: function(url) {
                    // Basic validation for Google Sheets URL
                    return url.includes('docs.google.com/spreadsheets');
                },
                message: 'Invalid Google Sheets URL'
            }
        },
        sheetId: {
            type: String,
            required: true,
            trim: true,
        },
        lastSyncedAt: {
            type: Date,
            default: null,
        },
        syncStatus: {
            type: String,
            enum: ['pending', 'syncing', 'success', 'failed'],
            default: 'pending',
        },
        lastSyncError: {
            type: String,
            default: null,
        },
        totalCouponsSynced: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const SheetConfig = mongoose.model('SheetConfig', sheetConfigSchema);

module.exports = SheetConfig;
