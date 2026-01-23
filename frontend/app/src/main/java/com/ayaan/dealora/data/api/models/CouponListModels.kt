package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Response data for paginated coupon list
 */
@JsonClass(generateAdapter = true)
data class CouponListResponseData(
    @Json(name = "total")
    val total: Int,

    @Json(name = "page")
    val page: Int,

    @Json(name = "limit")
    val limit: Int,

    @Json(name = "coupons")
    val coupons: List<CouponListItem>
)

/**
 * Coupon item model for list display
 */
@JsonClass(generateAdapter = true)
data class CouponListItem(
    @Json(name = "id")
    val id: String,

    @Json(name = "brandName")
    val brandName: String?,

    @Json(name = "couponTitle")
    val couponTitle: String?,

    @Json(name = "couponImageBase64")
    val couponImageBase64: String?,

    @Json(name = "description")
    val description: String? = null,

    @Json(name = "category")
    val category: String? = null,

    @Json(name = "daysUntilExpiry")
    val daysUntilExpiry: Int? = null
)

