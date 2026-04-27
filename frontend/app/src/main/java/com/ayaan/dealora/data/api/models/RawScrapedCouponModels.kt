package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Paginated response for raw scraped coupons (exclusive mode)
 */
@JsonClass(generateAdapter = true)
data class RawCouponListResponseData(
    @Json(name = "total") val total: Int,
    @Json(name = "page") val page: Int,
    @Json(name = "pages") val pages: Int,
    @Json(name = "count") val count: Int,
    @Json(name = "limit") val limit: Int,
    @Json(name = "coupons") val coupons: List<RawScrapedCoupon>
)

/**
 * A single raw scraped coupon as returned by /api/raw-coupons
 */
@JsonClass(generateAdapter = true)
data class RawScrapedCoupon(
    @Json(name = "_id") val id: String,

    @Json(name = "brandName") val brandName: String,

    @Json(name = "couponTitle") val couponTitle: String?,

    @Json(name = "description") val description: String? = null,

    @Json(name = "couponCode") val couponCode: String? = null,

    @Json(name = "discountType") val discountType: String? = null,

    @Json(name = "discountValue") val discountValue: String? = null,

    @Json(name = "category") val category: String? = null,

    @Json(name = "couponLink") val couponLink: String? = null,

    @Json(name = "expiryDate") val expiryDate: String? = null,

    @Json(name = "daysUntilExpiry") val daysUntilExpiry: Int? = null,

    @Json(name = "discountScore") val discountScore: Double? = null,

    @Json(name = "discountWeight") val discountWeight: Double? = null,

    @Json(name = "usedBy") val usedBy: Int? = null,

    @Json(name = "trustscore") val trustscore: Double? = null,

    @Json(name = "verified") val verified: Boolean? = null,

    @Json(name = "scrapedAt") val scrapedAt: String? = null
)
