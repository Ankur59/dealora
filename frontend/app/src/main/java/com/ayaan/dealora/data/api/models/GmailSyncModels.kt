package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request body sent to POST /api/features/gmail-sync
 */
@JsonClass(generateAdapter = true)
data class GmailSyncRequest(
    @Json(name = "accessToken")
    val accessToken: String,

    @Json(name = "userId")
    val userId: String,

    @Json(name = "selectedEmail")
    val selectedEmail: String? = null
)

/**
 * A single extracted coupon returned by the gmail-sync endpoint.
 * Fields mirror the backend Coupon model (only what we display).
 */
@JsonClass(generateAdapter = true)
data class GmailExtractedCoupon(
    @Json(name = "_id")
    val id: String? = null,

    @Json(name = "brandName")
    val brandName: String? = null,

    @Json(name = "couponName")
    val couponName: String? = null,

    @Json(name = "couponCode")
    val couponCode: String? = null,

    @Json(name = "discountType")
    val discountType: String? = null,

    @Json(name = "discountValue")
    val discountValue: Double? = null,

    @Json(name = "expireBy")
    val expireBy: String? = null,

    @Json(name = "description")
    val description: String? = null,

    @Json(name = "websiteLink")
    val websiteLink: String? = null,

    @Json(name = "couponVisitingLink")
    val couponVisitingLink: String? = null
)

/**
 * Top-level response from POST /api/features/gmail-sync
 */
@JsonClass(generateAdapter = true)
data class GmailSyncResponse(
    @Json(name = "success")
    val success: Boolean,

    @Json(name = "message")
    val message: String,

    @Json(name = "totalFound")
    val totalFound: Int? = null,

    @Json(name = "processedCount")
    val processedCount: Int? = null,

    @Json(name = "extractedCount")
    val extractedCount: Int? = null,

    @Json(name = "skippedCount")
    val skippedCount: Int? = null,

    @Json(name = "errorCount")
    val errorCount: Int? = null,

    @Json(name = "coupons")
    val coupons: List<GmailExtractedCoupon>? = null
)
