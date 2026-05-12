package com.ayaan.couponviewer.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class CouponData(
    val couponCode: String,
    val brandName: String,
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    val discountType: String? = null,
    val discountValue: String? = null,
    val minimumOrder: String? = null,
    val expiryDate: String? = null,
    val terms: String? = null,
    val sourcePackage: String? = null,
    val couponLink: String? = null
) : Parcelable {
    
    /**
     * Get formatted discount text
     */
    fun getDiscountText(): String {
        return when (discountType?.lowercase()) {
            "percentage" -> "$discountValue% Off"
            "flat" -> "₹$discountValue Off"
            "bogo" -> "Buy 1 Get 1 Free"
            else -> discountValue ?: "Special Offer"
        }
    }
    
    /**
     * Get brand initial for logo
     */
    fun getBrandInitial(): String {
        return brandName.firstOrNull()?.uppercase() ?: "?"
    }
    
    /**
     * Check if coupon has expiry info
     */
    fun hasExpiryInfo(): Boolean {
        return !expiryDate.isNullOrBlank()
    }
    
    /**
     * Check if coupon has minimum order requirement
     */
    fun hasMinimumOrder(): Boolean {
        return !minimumOrder.isNullOrBlank() && minimumOrder != "0"
    }
}
