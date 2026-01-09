package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Response data for single coupon detail
 */
@JsonClass(generateAdapter = true)
data class CouponDetailResponseData(
    @Json(name = "coupon")
    val coupon: CouponDetail
)

/**
 * Detailed coupon model
 */
@JsonClass(generateAdapter = true)
data class CouponDetail(
    @Json(name = "_id")
    val id: String,

    @Json(name = "userId")
    val userId: String,

    @Json(name = "couponName")
    val couponName: String?,

    @Json(name = "brandName")
    val brandName: String?,

    @Json(name = "couponTitle")
    val couponTitle: String?,

    @Json(name = "description")
    val description: String?,

    @Json(name = "expireBy")
    val expireBy: String?,

    @Json(name = "categoryLabel")
    val categoryLabel: String?,

    @Json(name = "useCouponVia")
    val useCouponVia: String?,

    @Json(name = "discountType")
    val discountType: String?,

    @Json(name = "discountValue")
    val discountValue: Any?,

    @Json(name = "minimumOrder")
    val minimumOrder: Any?,

    @Json(name = "couponCode")
    val couponCode: String?,

    @Json(name = "couponVisitingLink")
    val couponVisitingLink: String?,

    @Json(name = "couponDetails")
    val couponDetails: String?,

    @Json(name = "terms")
    val terms: String?,

    @Json(name = "status")
    val status: String?,

    @Json(name = "addedMethod")
    val addedMethod: String?,

    @Json(name = "base64ImageUrl")
    val base64ImageUrl: String?,

    @Json(name = "createdAt")
    val createdAt: String?,

    @Json(name = "updatedAt")
    val updatedAt: String?,

    @Json(name = "display")
    val display: CouponDisplay?,

    @Json(name = "actions")
    val actions: CouponActions?
)

