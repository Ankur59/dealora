package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request body for POST /api/terms/accept
 */
@JsonClass(generateAdapter = true)
data class TermsAcceptRequest(
    @Json(name = "userId") val userId: String,
    @Json(name = "termsVersion") val termsVersion: String
)

/**
 * Response from POST /api/terms/accept
 */
@JsonClass(generateAdapter = true)
data class TermsAcceptResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String? = null,
    @Json(name = "acceptedAt") val acceptedAt: String? = null
)
