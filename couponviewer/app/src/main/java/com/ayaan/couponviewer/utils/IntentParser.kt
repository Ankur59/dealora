package com.ayaan.couponviewer.utils

import android.content.Intent
import com.ayaan.couponviewer.data.models.CouponData

object IntentParser {
    
    /**
     * Parse coupon data from Intent extras
     */
    fun parseIntent(intent: Intent): CouponData? {
        return try {
            // Extract required fields
            val couponCode = intent.getStringExtra("EXTRA_COUPON_CODE")
            val brandName = intent.getStringExtra("EXTRA_BRAND_NAME")
            
            if (couponCode.isNullOrBlank() || brandName.isNullOrBlank()) {
                return null
            }
            
            // Extract optional fields
            CouponData(
                couponCode = couponCode,
                brandName = brandName,
                title = intent.getStringExtra("EXTRA_COUPON_TITLE"),
                description = intent.getStringExtra("EXTRA_DESCRIPTION"),
                category = intent.getStringExtra("EXTRA_CATEGORY"),
                discountType = intent.getStringExtra("EXTRA_DISCOUNT_TYPE"),
                discountValue = intent.getStringExtra("EXTRA_DISCOUNT_VALUE"),
                minimumOrder = intent.getStringExtra("EXTRA_MINIMUM_ORDER"),
                expiryDate = intent.getStringExtra("EXTRA_EXPIRY_DATE"),
                terms = intent.getStringExtra("EXTRA_TERMS"),
                sourcePackage = intent.getStringExtra("EXTRA_SOURCE_PACKAGE"),
                couponLink = intent.getStringExtra("EXTRA_COUPON_LINK")
            )
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * Parse coupon data from deep link URI
     */
    fun parseDeepLink(intent: Intent): CouponData? {
        val uri = intent.data ?: return null
        
        return try {
            val code = uri.getQueryParameter("code") ?: return null
            val brand = uri.getQueryParameter("brand") ?: return null
            
            CouponData(
                couponCode = code,
                brandName = brand,
                title = uri.getQueryParameter("title"),
                description = uri.getQueryParameter("description"),
                category = uri.getQueryParameter("category"),
                discountType = uri.getQueryParameter("discountType"),
                discountValue = uri.getQueryParameter("discountValue"),
                minimumOrder = uri.getQueryParameter("minOrder"),
                expiryDate = uri.getQueryParameter("expiry"),
                terms = uri.getQueryParameter("terms"),
                sourcePackage = uri.getQueryParameter("sourcePackage"),
                couponLink = uri.getQueryParameter("link")
            )
        } catch (e: Exception) {
            null
        }
    }
}
