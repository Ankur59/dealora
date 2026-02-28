package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json

/**
 * Request model for OCR extraction
 */
data class OcrRequest(
    @Json(name = "image") val image: String,
    @Json(name = "userId") val userId: String? = null
)

/**
 * Response model for OCR extraction
 */
data class OcrResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String,
    @Json(name = "data") val data: Coupon? = null,

    @Json(name = "confidence") val confidence: Double? = null,
    @Json(name = "error") val error: String? = null
)
