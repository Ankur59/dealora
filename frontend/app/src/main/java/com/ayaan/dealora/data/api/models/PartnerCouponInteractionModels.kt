package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ── Request bodies ─────────────────────────────────────────────────────────────

/** POST /api/partner-coupon-interactions */
@JsonClass(generateAdapter = true)
data class RecordPartnerInteractionRequest(
    @Json(name = "userId")     val userId:     String,
    @Json(name = "couponId")   val couponId:   String,
    @Json(name = "brandName")  val brandName:  String,
    @Json(name = "couponCode") val couponCode: String? = null,
    @Json(name = "couponLink") val couponLink: String? = null,
    /** "discover" | "redeem" */
    @Json(name = "action")     val action:     String,
)

// ── Response models ────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class RecordPartnerInteractionData(
    @Json(name = "interactionId") val interactionId: String,
)

@JsonClass(generateAdapter = true)
data class RecordPartnerInteractionResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String? = null,
    @Json(name = "data")    val data:    RecordPartnerInteractionData? = null,
)

/** A single pending partner coupon interaction — returned from GET /pending */
@JsonClass(generateAdapter = true)
data class PendingPartnerInteraction(
    @Json(name = "_id")        val id:         String,
    @Json(name = "userId")     val userId:     String,
    @Json(name = "couponId")   val couponId:   String,
    @Json(name = "brandName")  val brandName:  String,
    @Json(name = "couponCode") val couponCode: String? = null,
    @Json(name = "couponLink") val couponLink: String? = null,
    /** "discover" | "redeem" */
    @Json(name = "action")     val action:     String,
    /** "pending" | "success" | "failure" | "skipped" */
    @Json(name = "outcome")    val outcome:    String,
    @Json(name = "createdAt")  val createdAt:  String? = null,
)

@JsonClass(generateAdapter = true)
data class PendingPartnerInteractionsData(
    @Json(name = "count")        val count:        Int,
    @Json(name = "interactions") val interactions: List<PendingPartnerInteraction>,
)

@JsonClass(generateAdapter = true)
data class PendingPartnerInteractionsResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data")    val data:    PendingPartnerInteractionsData? = null,
)
