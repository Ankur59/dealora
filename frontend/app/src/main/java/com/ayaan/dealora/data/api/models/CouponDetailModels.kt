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
    val id: Any?=null,

    @Json(name = "userId")
    val userId: Any?=null,

    @Json(name = "couponName")
    val couponName: Any?=null,

    @Json(name = "brandName")
    val brandName: Any?=null,

    @Json(name = "couponTitle")
    val couponTitle: Any?=null,

    @Json(name = "description")
    val description: Any?=null,

    @Json(name = "expireBy")
    val expireBy: Any?=null,

    @Json(name = "categoryLabel")
    val categoryLabel: Any?=null,

    @Json(name = "useCouponVia")
    val useCouponVia: Any?=null,

    @Json(name = "discountType")
    val discountType: Any?=null,

    @Json(name = "discountValue")
    val discountValue: Any?=null,

    @Json(name = "minimumOrder")
    val minimumOrder: Any?=null,

    @Json(name = "couponCode")
    val couponCode: Any?=null,

    @Json(name = "couponVisitingLink")
    val couponVisitingLink: Any?=null,

    @Json(name = "couponDetails")
    val couponDetails: Any?=null,

    @Json(name = "terms")
    val terms: Any?=null,

    @Json(name = "status")
    val status: Any?=null,

    @Json(name = "addedMethod")
    val addedMethod: Any?=null,

    @Json(name = "base64ImageUrl")
    val base64ImageUrl: Any?=null,

    @Json(name = "createdAt")
    val createdAt: Any?=null,

    @Json(name = "updatedAt")
    val updatedAt: Any?=null,

    @Json(name = "display")
    val display: CouponDisplay?=null,

    @Json(name = "actions")
    val actions: CouponActions?=null
)

