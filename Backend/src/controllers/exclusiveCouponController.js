const axios = require('axios');
const { parse } = require('csv-parse/sync');
const ExclusiveCoupon = require('../models/ExclusiveCoupon');
const SheetConfig = require('../models/SheetConfig');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES } = require('../config/constants');

/**
 * Extract Sheet ID from Google Sheets URL
 */
const extractSheetId = (url) => {
    try {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return match[1];
        }
        throw new Error('Invalid Google Sheets URL format');
    } catch (error) {
        throw new Error('Could not extract Sheet ID from URL');
    }
};

/**
 * Convert Google Sheets URL to CSV Export URL
 */
const getCSVExportUrl = (sheetId) => {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
};

/**
 * Parse date from various formats
 */
const parseDate = (dateString) => {
    if (!dateString || dateString.trim() === '') return null;
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (error) {
        return null;
    }
};

/**
 * Sync coupons from Google Sheet to MongoDB
 */
const syncSheet = async () => {
    logger.info('Starting Google Sheet sync...');
    
    try {
        // 1. Get sheet configuration from DB
        const sheetConfig = await SheetConfig.findOne();
        
        if (!sheetConfig) {
            logger.warn('No sheet configuration found. Please add a sheet URL first.');
            return { success: false, message: 'No sheet configured' };
        }

        // 2. Update sync status
        sheetConfig.syncStatus = 'syncing';
        await sheetConfig.save();

        // 3. Get CSV export URL
        const csvUrl = getCSVExportUrl(sheetConfig.sheetId);
        logger.info(`Fetching data from: ${csvUrl}`);

        // 4. Fetch CSV data
        const response = await axios.get(csvUrl, {
            responseType: 'text',
            timeout: 30000, // 30 seconds timeout
        });

        if (!response.data) {
            throw new Error('No data received from Google Sheets');
        }

        // 5. Parse CSV data
        const records = parse(response.data, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,
        });

        logger.info(`Parsed ${records.length} rows from CSV`);

        // 6. Process and upsert each coupon
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const row of records) {
            try {
                // Map CSV columns to schema fields
                const couponData = {
                    couponName: row['Coupon Name'] || row['couponName'] || '',
                    brandName: row['Brand Name'] || row['brandName'] || '',
                    description: row['Coupon Description'] || row['description'] || '',
                    expiryDate: parseDate(row['Expiry Date'] || row['expiryDate']),
                    category: row['Category Label'] || row['category'] || '',
                    couponCode: (row['CouponCode'] || row['couponCode'] || '').toUpperCase().trim(),
                    couponLink: row['CouponLink'] || row['couponLink'] || '',
                    details: row['Details'] || row['details'] || '',
                    terms: row['Terms'] || row['terms'] || '',
                    stackable: row['Stackable'] || row['stackable'] || '',
                    source: row['Source'] || row['source'] || '',
                };

                // Skip if coupon code is empty
                if (!couponData.couponCode) {
                    logger.warn(`Skipping row with missing coupon code: ${JSON.stringify(row)}`);
                    failCount++;
                    continue;
                }

                // Skip if brand name or coupon name is empty
                if (!couponData.brandName || !couponData.couponName) {
                    logger.warn(`Skipping row with missing brand/coupon name: ${couponData.couponCode}`);
                    failCount++;
                    continue;
                }

                // Upsert coupon using brandName + couponName as composite unique key
                // This allows editing coupon codes while updating the same document
                await ExclusiveCoupon.findOneAndUpdate(
                    { 
                        brandName: couponData.brandName,
                        couponName: couponData.couponName 
                    },
                    couponData,
                    { upsert: true, new: true, runValidators: true }
                );

                successCount++;
            } catch (rowError) {
                failCount++;
                const errorMsg = `Failed to process coupon ${row['CouponCode']}: ${rowError.message}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
            }
        }

        // 7. Update sheet config with sync results
        sheetConfig.lastSyncedAt = new Date();
        sheetConfig.syncStatus = 'success';
        sheetConfig.totalCouponsSynced = successCount;
        sheetConfig.lastSyncError = errors.length > 0 ? errors.join('; ') : null;
        await sheetConfig.save();

        const result = {
            success: true,
            message: 'Sheet sync completed',
            stats: {
                totalRows: records.length,
                successCount,
                failCount,
                errors: errors.slice(0, 10), // Return first 10 errors
            }
        };

        logger.info(`Sheet sync completed: ${successCount} success, ${failCount} failed`);
        return result;

    } catch (error) {
        logger.error('Sheet sync failed:', error);
        
        // Update sheet config with error
        try {
            const sheetConfig = await SheetConfig.findOne();
            if (sheetConfig) {
                sheetConfig.syncStatus = 'failed';
                sheetConfig.lastSyncError = error.message;
                await sheetConfig.save();
            }
        } catch (updateError) {
            logger.error('Failed to update sheet config after error:', updateError);
        }

        return {
            success: false,
            message: 'Sheet sync failed',
            error: error.message,
        };
    }
};

/**
 * POST /add-sheet - Add or update Google Sheet URL
 */
const addSheet = async (req, res, next) => {
    try {
        const { sheetUrl } = req.body;

        if (!sheetUrl) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Sheet URL is required');
        }

        // Extract sheet ID from URL
        const sheetId = extractSheetId(sheetUrl);

        // Delete any existing sheet config (only one sheet allowed)
        await SheetConfig.deleteMany({});

        // Create new sheet config
        const newConfig = await SheetConfig.create({
            sheetUrl: sheetUrl.trim(),
            sheetId: sheetId,
        });

        logger.info(`Sheet URL added/updated: ${sheetUrl}`);

        // Trigger immediate sync
        const syncResult = await syncSheet();

        return successResponse(
            res,
            STATUS_CODES.CREATED,
            'Sheet URL added successfully and initial sync completed',
            {
                config: newConfig,
                syncResult: syncResult,
            }
        );

    } catch (error) {
        logger.error('Add sheet error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons - Get all exclusive coupons with advanced filtering and sorting
 */
const getExclusiveCoupons = async (req, res, next) => {
    try {
        const { 
            brands,
            brand,
            category, 
            search,
            source,
            stackable,
            validity,
            sortBy = 'newest_first',
            limit = 20, 
            page = 1
        } = req.query;

        logger.info('Fetching exclusive coupons with filters:', { brands, brand, category, search, source, stackable, validity, sortBy });

        // Build query
        const query = {};

        // Brand Filter (supports both single brand and multiple brands)
        if (brands) {
            const brandArray = Array.isArray(brands) ? brands : brands.split(',');
            query.brandName = {
                $in: brandArray.map(b => new RegExp(`^${b.trim()}$`, 'i'))
            };
        } else if (brand) {
            query.brandName = new RegExp(brand, 'i');
        }

        // Category Filter
        if (category && category !== 'All' && category !== 'See all') {
            query.category = new RegExp(`^${category.trim()}$`, 'i');
        }

        // Source Filter (Grabon, Official, etc.)
        if (source && source !== 'All') {
            query.source = new RegExp(`^${source.trim()}$`, 'i');
        }

        // Stackable Filter
        if (stackable) {
            if (stackable.toLowerCase() === 'yes' || stackable.toLowerCase() === 'true') {
                query.stackable = new RegExp('^yes$', 'i');
            } else if (stackable.toLowerCase() === 'no' || stackable.toLowerCase() === 'false') {
                query.stackable = new RegExp('^no$', 'i');
            }
        }

        // Search Logic (search across multiple fields)
        if (search && search.trim() !== '') {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { couponName: searchRegex },
                    { brandName: searchRegex },
                    { description: searchRegex },
                    { category: searchRegex },
                    { couponCode: searchRegex },
                    { details: searchRegex },
                    { terms: searchRegex }
                ]
            });
        }

        // Validity Filter
        if (validity) {
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);

            if (validity === 'valid_today' || validity === 'Valid Today') {
                query.expiryDate = { $gte: now };
            } else if (validity === 'valid_this_week' || validity === 'Valid This Week') {
                query.expiryDate = { $gte: now };
            } else if (validity === 'valid_this_month' || validity === 'Valid This Month') {
                query.expiryDate = { $gte: now };
            } else if (validity === 'expiring_today' || validity === 'Expiring Today') {
                query.expiryDate = { $gte: now, $lte: todayEnd };
            } else if (validity === 'expiring_this_week' || validity === 'Expiring This Week') {
                query.expiryDate = { $gte: now, $lte: weekEnd };
            } else if (validity === 'expiring_this_month' || validity === 'Expiring This Month') {
                query.expiryDate = { $gte: now, $lte: monthEnd };
            } else if (validity === 'expired' || validity === 'Expired') {
                query.expiryDate = { $lt: now };
            } else if (validity === 'all' || validity === 'All') {
                // No expiry filter - show all coupons
            }
        } else {
            // Default: Filter out expired coupons
            query.$or = [
                { expiryDate: { $gte: new Date() } },
                { expiryDate: null }
            ];
        }

        // Sorting
        let sortOptions = {};
        if (sortBy === 'newest_first' || sortBy === 'newest') {
            sortOptions = { createdAt: -1 };
        } else if (sortBy === 'oldest_first' || sortBy === 'oldest') {
            sortOptions = { createdAt: 1 };
        } else if (sortBy === 'expiring_soon' || sortBy === 'expiry') {
            sortOptions = { expiryDate: 1 };
        } else if (sortBy === 'a_to_z' || sortBy === 'name_asc') {
            sortOptions = { brandName: 1, couponName: 1 };
        } else if (sortBy === 'z_to_a' || sortBy === 'name_desc') {
            sortOptions = { brandName: -1, couponName: -1 };
        } else {
            // Default sorting
            sortOptions = { createdAt: -1 };
        }

        // Pagination
        const limitNum = Math.min(parseInt(limit), 100);
        const skip = (parseInt(page) - 1) * limitNum;

        // Execute query
        const total = await ExclusiveCoupon.countDocuments(query);
        const coupons = await ExclusiveCoupon.find(query)
            .sort(sortOptions)
            .limit(limitNum)
            .skip(skip)
            .lean();

        // Calculate daysUntilExpiry dynamically
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        const couponsWithDynamicExpiry = coupons.map(coupon => {
            if (coupon.expiryDate) {
                const expiryDate = new Date(coupon.expiryDate);
                expiryDate.setHours(0, 0, 0, 0);

                const timeDiff = expiryDate.getTime() - currentDate.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                return {
                    ...coupon,
                    daysUntilExpiry: daysDiff
                };
            }
            return coupon;
        });

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Exclusive coupons retrieved successfully',
            {
                count: couponsWithDynamicExpiry.length,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limitNum),
                coupons: couponsWithDynamicExpiry
            }
        );

    } catch (error) {
        logger.error('Get exclusive coupons error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons/:couponCode - Get single exclusive coupon by code
 */
const getExclusiveCouponByCode = async (req, res, next) => {
    try {
        const { couponCode } = req.params;

        const coupon = await ExclusiveCoupon.findOne({ 
            couponCode: couponCode.toUpperCase() 
        }).lean();

        if (!coupon) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'Exclusive coupon not found'
            );
        }

        return successResponse(res, STATUS_CODES.OK, 'Exclusive coupon retrieved successfully', coupon);

    } catch (error) {
        logger.error('Get exclusive coupon by code error:', error);
        return next(error);
    }
};

/**
 * POST /sync-now - Manually trigger sheet sync
 */
const syncNow = async (req, res, next) => {
    try {
        const result = await syncSheet();

        if (result.success) {
            return successResponse(res, STATUS_CODES.OK, 'Sheet sync completed', result);
        } else {
            return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, result.message || 'Sync failed');
        }

    } catch (error) {
        logger.error('Manual sync error:', error);
        return next(error);
    }
};

/**
 * GET /sheet-config - Get current sheet configuration and sync status
 */
const getSheetConfig = async (req, res, next) => {
    try {
        const config = await SheetConfig.findOne().lean();

        if (!config) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'No sheet configured yet'
            );
        }

        return successResponse(res, STATUS_CODES.OK, 'Sheet configuration retrieved', config);

    } catch (error) {
        logger.error('Get sheet config error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons/filters/brands - Get unique brand names
 */
const getUniqueBrands = async (req, res, next) => {
    try {
        const brands = await ExclusiveCoupon.distinct('brandName');
        const sortedBrands = brands.filter(b => b).sort();

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Brands retrieved successfully',
            {
                count: sortedBrands.length,
                brands: sortedBrands
            }
        );

    } catch (error) {
        logger.error('Get unique brands error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons/filters/categories - Get unique categories
 */
const getUniqueCategories = async (req, res, next) => {
    try {
        const categories = await ExclusiveCoupon.distinct('category');
        const sortedCategories = categories.filter(c => c).sort();

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Categories retrieved successfully',
            {
                count: sortedCategories.length,
                categories: sortedCategories
            }
        );

    } catch (error) {
        logger.error('Get unique categories error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons/filters/sources - Get unique sources
 */
const getUniqueSources = async (req, res, next) => {
    try {
        const sources = await ExclusiveCoupon.distinct('source');
        const sortedSources = sources.filter(s => s).sort();

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Sources retrieved successfully',
            {
                count: sortedSources.length,
                sources: sortedSources
            }
        );

    } catch (error) {
        logger.error('Get unique sources error:', error);
        return next(error);
    }
};

/**
 * GET /exclusive-coupons/stats - Get coupon statistics
 */
const getCouponStats = async (req, res, next) => {
    try {
        const now = new Date();
        
        const [
            totalCoupons,
            activeCoupons,
            expiredCoupons,
            expiringThisWeek,
            totalBrands,
            totalCategories
        ] = await Promise.all([
            ExclusiveCoupon.countDocuments(),
            ExclusiveCoupon.countDocuments({
                $or: [
                    { expiryDate: { $gte: now } },
                    { expiryDate: null }
                ]
            }),
            ExclusiveCoupon.countDocuments({ expiryDate: { $lt: now } }),
            ExclusiveCoupon.countDocuments({
                expiryDate: {
                    $gte: now,
                    $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                }
            }),
            ExclusiveCoupon.distinct('brandName').then(brands => brands.length),
            ExclusiveCoupon.distinct('category').then(cats => cats.filter(c => c).length)
        ]);

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Statistics retrieved successfully',
            {
                totalCoupons,
                activeCoupons,
                expiredCoupons,
                expiringThisWeek,
                totalBrands,
                totalCategories
            }
        );

    } catch (error) {
        logger.error('Get coupon stats error:', error);
        return next(error);
    }
};

module.exports = {
    addSheet,
    getExclusiveCoupons,
    getExclusiveCouponByCode,
    syncNow,
    getSheetConfig,
    getUniqueBrands,
    getUniqueCategories,
    getUniqueSources,
    getCouponStats,
    syncSheet, // Export for cron job
};
