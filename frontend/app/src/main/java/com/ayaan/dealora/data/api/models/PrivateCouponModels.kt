package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request model for syncing private coupons
 */
@JsonClass(generateAdapter = true)
data class SyncPrivateCouponsRequest(
    @Json(name = "brands")
    val brands: List<String>
)

/**
 * Response data for private coupons sync
 */
@JsonClass(generateAdapter = true)
data class PrivateCouponResponseData(
    @Json(name = "count")
    val count: Int,

    @Json(name = "coupons")
    val coupons: List<PrivateCoupon>
)

/**
 * Response data for private coupon redeem
 */
@JsonClass(generateAdapter = true)
data class PrivateCouponRedeemResponseData(
    @Json(name = "coupon")
    val coupon: PrivateCoupon
)

/**
 * Private coupon model
 */
@JsonClass(generateAdapter = true)
data class PrivateCoupon(
    @Json(name = "_id")
    val id: String,

    @Json(name = "brandName")
    val brandName: String,

    @Json(name = "couponTitle")
    val couponTitle: String,

    @Json(name = "category")
    val category: String? = null,

    @Json(name = "expiryDate")
    val expiryDate: String? = null,

    @Json(name = "daysUntilExpiry")
    val daysUntilExpiry: Int? = null,

    @Json(name = "description")
    val description: String? = null,

    @Json(name = "couponCode")
    val couponCode: String? = null,

    @Json(name = "redeemable")
    val redeemable: Boolean? = true,

    @Json(name = "redeemed")
    val redeemed: Boolean? = false,

    @Json(name = "redeemedBy")
    val redeemedBy: String? = null,

    @Json(name = "redeemedAt")
    val redeemedAt: String? = null,

    @Json(name = "minimumOrderValue")
    val minimumOrderValue: String? = null,

    @Json(name = "couponLink")
    val couponLink: String? = null,

    @Json(name = "createdAt")
    val createdAt: String? = null,

    @Json(name = "updatedAt")
    val updatedAt: String? = null
)
