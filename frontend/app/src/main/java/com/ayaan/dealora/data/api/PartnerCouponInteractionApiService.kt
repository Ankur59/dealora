package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.PendingPartnerInteractionsResponse
import com.ayaan.dealora.data.api.models.RecordPartnerInteractionRequest
import com.ayaan.dealora.data.api.models.RecordPartnerInteractionResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit API interface for /api/partner-coupon-interactions
 *
 * Tracks user "discover" clicks on partner coupons (from ai-coupon-engine)
 * and drives the "did it work?" feedback popup on next app open.
 */
interface PartnerCouponInteractionApiService {

    /** Record a discover / redeem interaction for a partner coupon */
    @POST("api/partner-coupon-interactions")
    suspend fun recordInteraction(
        @Body request: RecordPartnerInteractionRequest
    ): Response<RecordPartnerInteractionResponse>

    /** Get all PENDING interactions for a user (shown as feedback popup on next open) */
    @GET("api/partner-coupon-interactions/pending")
    suspend fun getPendingInteractions(
        @Query("userId") userId: String
    ): Response<PendingPartnerInteractionsResponse>

    /** Resolve a pending interaction: outcome = "success" | "failure" | "skipped" */
    @PATCH("api/partner-coupon-interactions/{id}/resolve")
    suspend fun resolveInteraction(
        @Path("id")  interactionId: String,
        @Body        body:          Map<String, String>
    ): Response<Any>
}
