package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Response data for paginated exclusive coupon list
 */
@JsonClass(generateAdapter = true)
data class ExclusiveCouponListResponseData(
    @Json(name = "count")
    val count: Int,

    @Json(name = "total")
    val total: Int,

    @Json(name = "page")
    val page: Int,

    @Json(name = "pages")
    val pages: Int,

    @Json(name = "coupons")
    val coupons: List<ExclusiveCoupon>
)

/**
 * Exclusive coupon model matching backend response
 */
@JsonClass(generateAdapter = true)
data class ExclusiveCoupon(
    @Json(name = "_id")
    val id: String,

    @Json(name = "couponName")
    val couponName: String,

    @Json(name = "brandName")
    val brandName: String,

    @Json(name = "description")
    val description: String? = null,

    @Json(name = "expiryDate")
    val expiryDate: String? = null,

    @Json(name = "category")
    val category: String? = null,

    @Json(name = "couponCode")
    val couponCode: String,

    @Json(name = "couponLink")
    val couponLink: String? = null,

    @Json(name = "details")
    val details: String? = null,

    @Json(name = "terms")
    val terms: String? = null,

    @Json(name = "stackable")
    val stackable: String? = null,

    @Json(name = "source")
    val source: String? = null,

    @Json(name = "createdAt")
    val createdAt: String? = null,

    @Json(name = "updatedAt")
    val updatedAt: String? = null,

    @Json(name = "daysUntilExpiry")
    val daysUntilExpiry: Int? = null
)

/**
 * Response for exclusive coupon detail by code
 */
@JsonClass(generateAdapter = true)
data class ExclusiveCouponDetailResponseData(
    @Json(name = "coupon")
    val coupon: ExclusiveCoupon
)

/**
 * Response for unique brands
 */
@JsonClass(generateAdapter = true)
data class UniqueBrandsResponseData(
    @Json(name = "brands")
    val brands: List<String>
)

/**
 * Response for unique categories
 */
@JsonClass(generateAdapter = true)
data class UniqueCategoriesResponseData(
    @Json(name = "categories")
    val categories: List<String>
)

/**
 * Response for unique sources
 */
@JsonClass(generateAdapter = true)
data class UniqueSourcesResponseData(
    @Json(name = "sources")
    val sources: List<String>
)

/**
 * Response for coupon statistics
 */
@JsonClass(generateAdapter = true)
data class ExclusiveCouponStatsResponseData(
    @Json(name = "total")
    val total: Int,

    @Json(name = "active")
    val active: Int,

    @Json(name = "expired")
    val expired: Int,

    @Json(name = "expiringSoon")
    val expiringSoon: Int,

    @Json(name = "byCategory")
    val byCategory: Map<String, Int>,

    @Json(name = "bySource")
    val bySource: Map<String, Int>
)

