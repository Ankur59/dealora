package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request model for creating a coupon
 */
@JsonClass(generateAdapter = true)
data class CreateCouponRequest(
    @Json(name = "uid")
    val uid: String,

    @Json(name = "couponName")
    val couponName: String,

    @Json(name = "description")
    val description: String? = null,

    @Json(name = "expireBy")
    val expireBy: String,

    @Json(name = "categoryLabel")
    val categoryLabel: String? = null,

    @Json(name = "useCouponVia")
    val useCouponVia: String,

    @Json(name = "couponCode")
    val couponCode: String? = null,

    @Json(name = "couponVisitingLink")
    val couponVisitingLink: String? = null,

    @Json(name = "couponDetails")
    val couponDetails: String? = null
)

/**
 * Response data for coupon creation
 */
@JsonClass(generateAdapter = true)
data class CouponResponseData(
    @Json(name = "coupon")
    val coupon: Coupon,

    @Json(name = "couponImageBase64")
    val couponImageBase64: String? = null
)

/**
 * Coupon model matching backend response
 */
@JsonClass(generateAdapter = true)
data class Coupon(
    @Json(name = "_id")
    val id: String,

    @Json(name = "userId")
    val userId: String,

    @Json(name = "couponName")
    val couponName: String,

    @Json(name = "description")
    val description: String?,

    @Json(name = "expireBy")
    val expireBy: String,

    @Json(name = "categoryLabel")
    val categoryLabel: String?,

    @Json(name = "useCouponVia")
    val useCouponVia: String,

    @Json(name = "couponCode")
    val couponCode: String?,

    @Json(name = "couponVisitingLink")
    val couponVisitingLink: String?,

    @Json(name = "couponDetails")
    val couponDetails: String?,

    @Json(name = "status")
    val status: String,

    @Json(name = "addedMethod")
    val addedMethod: String,

    @Json(name = "redeemedAt")
    val redeemedAt: String?,

    @Json(name = "createdAt")
    val createdAt: String,

    @Json(name = "updatedAt")
    val updatedAt: String,

    @Json(name = "display")
    val display: CouponDisplay?,

    @Json(name = "actions")
    val actions: CouponActions?
)

@JsonClass(generateAdapter = true)
data class CouponDisplay(
    @Json(name = "initial")
    val initial: String,

    @Json(name = "daysUntilExpiry")
    val daysUntilExpiry: Int?,

    @Json(name = "isExpiringSoon")
    val isExpiringSoon: Boolean,

    @Json(name = "formattedExpiry")
    val formattedExpiry: String,

    @Json(name = "expiryStatusColor")
    val expiryStatusColor: String,

    @Json(name = "badgeLabels")
    val badgeLabels: List<String>,

    @Json(name = "redemptionType")
    val redemptionType: String
)

@JsonClass(generateAdapter = true)
data class CouponActions(
    @Json(name = "canEdit")
    val canEdit: Boolean,

    @Json(name = "canDelete")
    val canDelete: Boolean,

    @Json(name = "canRedeem")
    val canRedeem: Boolean,

    @Json(name = "canShare")
    val canShare: Boolean
)

