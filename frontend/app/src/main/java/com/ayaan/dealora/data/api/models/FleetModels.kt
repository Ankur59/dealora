package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Fleet Engine — Coupon Interaction models
 *
 * Tracks user interactions (copy / discover / redeem) with exclusive scraped
 * coupons and drives the "did it work?" feedback popup on next page load.
 */

// ── Request bodies ────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class RecordInteractionRequest(
    @Json(name = "userId")     val userId: String,
    @Json(name = "couponId")   val couponId: String,
    @Json(name = "brandName")  val brandName: String,
    @Json(name = "couponCode") val couponCode: String? = null,
    @Json(name = "couponLink") val couponLink: String? = null,
    /** "copy" | "discover" | "redeem" */
    @Json(name = "action")     val action: String,
)

@JsonClass(generateAdapter = true)
data class ResolveInteractionRequest(
    /** "success" | "failure" | "skipped" */
    @Json(name = "outcome") val outcome: String,
)

// ── Response models ───────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class RecordInteractionResponse(
    @Json(name = "interactionId") val interactionId: String,
)

@JsonClass(generateAdapter = true)
data class RecordInteractionResponseData(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data")    val data: RecordInteractionResponse? = null,
)

/** A single pending interaction returned from GET /api/fleet/interactions/pending */
@JsonClass(generateAdapter = true)
data class PendingInteraction(
    @Json(name = "_id")        val id: String,
    @Json(name = "userId")     val userId: String,
    @Json(name = "couponId")   val couponId: String,
    @Json(name = "brandName")  val brandName: String,
    @Json(name = "couponCode") val couponCode: String? = null,
    @Json(name = "couponLink") val couponLink: String? = null,
    /** "copy" | "discover" | "redeem" */
    @Json(name = "action")     val action: String,
    /** "pending" | "success" | "failure" | "skipped" */
    @Json(name = "outcome")    val outcome: String,
    @Json(name = "createdAt")  val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class PendingInteractionsData(
    @Json(name = "count")        val count: Int,
    @Json(name = "interactions") val interactions: List<PendingInteraction>,
)

@JsonClass(generateAdapter = true)
data class PendingInteractionsResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data")    val data: PendingInteractionsData? = null,
)
