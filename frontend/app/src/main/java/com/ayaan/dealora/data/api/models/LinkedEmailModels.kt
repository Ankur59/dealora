package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * A single linked Gmail account entry returned by GET /api/connect-email/linked-emails
 */
@JsonClass(generateAdapter = true)
data class LinkedEmail(
    @Json(name = "email") val email: String,
    @Json(name = "linkedAt") val linkedAt: String? = null
)

/**
 * Top-level response from GET /api/connect-email/linked-emails
 */
@JsonClass(generateAdapter = true)
data class LinkedEmailsResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "count") val count: Int = 0,
    @Json(name = "data") val data: List<LinkedEmail> = emptyList()
)

/**
 * Request body for POST /api/connect-email/link-gmail
 * serverAuthCode — the one-time code returned by Google Sign-In on the device.
 * The backend exchanges this for a refresh_token.
 */
@JsonClass(generateAdapter = true)
data class LinkGmailRequest(
    @Json(name = "serverAuthCode") val serverAuthCode: String,
    @Json(name = "userId") val userId: String
)

/**
 * Response from POST /api/connect-email/link-gmail
 */
@JsonClass(generateAdapter = true)
data class LinkGmailResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String,
    @Json(name = "email") val email: String? = null
)
