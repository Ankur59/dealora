package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json

data class OcrRequest(
    @Json(name = "image") val base64Image: String,
    @Json(name = "userId") val userId: String? = null
)

data class OcrResponse(
    val success: Boolean,
    val message: String,
    val data: CouponResponseData?,
    val confidence: Double?
)

data class GmailSyncRequest(
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "userId") val userId: String? = null
)

data class GmailSyncResponse(
    val success: Boolean,
    val message: String,
    val totalFound: Int,
    val processedCount: Int,
    val extractedCount: Int,
    val skippedCount: Int,
    val errorCount: Int,
    val coupons: List<CouponResponseData>?
)

data class FeatureStatusResponse(
    val status: String,
    val service: String,
    val model: String?,
    val keyConfigured: Boolean,
    val availableFeatures: List<String>
)
