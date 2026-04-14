// API calls for coupomated
import limitedGet from "../config/axios.js";

/**
 * Fetches all categories from Coupomated API
 * @returns {Promise<Object>} API response data
 */
export const getAllCategories = async () => {
    try {
        console.log("getting here")
        const response = await limitedGet("https://api.coupomated.com/categories/coupon", {
            params: {
                apikey: process.env.COUPO_MATED_API_KEY
            }
        });
        return response.data;
        // console.log(response)
    } catch (error) {
        console.error("Error fetching categories from Coupomated:", error.message);
        throw error;
    }
};

/**
 * Fetches all coupons from Coupomated API
 * @returns {Promise<Object>} API response data
 */
export const getAllCoupons = async () => {
    try {
        const response = await limitedGet("https://api.coupomated.com/coupons/all", {
            params: {
                apikey: process.env.COUPO_MATED_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching coupons from Coupomated:", error.message);
        throw error;
    }
};

/**
 * Fetches recently updated coupons from Coupomated API
 * @returns {Promise<Object>} API response data
 */
export const getUpdatedCoupons = async () => {
    try {
        const response = await limitedGet("https://api.coupomated.com/coupons/updated", {
            params: {
                apikey: process.env.COUPO_MATED_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching updated coupons from Coupomated:", error.message);
        throw error;
    }
};

/**
 * Fetches expired coupons from Coupomated API
 * @returns {Promise<Object>} API response data
 */
export const getExpiredCoupons = async () => {
    try {
        const response = await limitedGet("https://api.coupomated.com/coupons/expired", {
            params: {
                apikey: process.env.COUPO_MATED_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching expired coupons from Coupomated:", error.message);
        throw error;
    }
};
