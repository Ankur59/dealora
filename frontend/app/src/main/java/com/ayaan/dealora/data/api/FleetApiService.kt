package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.PendingInteractionsResponse
import com.ayaan.dealora.data.api.models.RecordInteractionRequest
import com.ayaan.dealora.data.api.models.RecordInteractionResponseData
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Fleet Engine API — /api/fleet
 *
 * Records user interactions with exclusive/scraped coupons and drives
 * the "did it work?" feedback popup.
 */
interface FleetApiService {

    /** Record a copy / discover / redeem interaction */
    @POST("api/fleet/interactions")
    suspend fun recordInteraction(
        @Body request: RecordInteractionRequest
    ): Response<RecordInteractionResponseData>

    /** Get all PENDING interactions for a user (shown as feedback popup) */
    @GET("api/fleet/interactions/pending")
    suspend fun getPendingInteractions(
        @Query("userId") userId: String
    ): Response<PendingInteractionsResponse>

    /** Resolve a pending interaction with success / failure / skipped */
    @PATCH("api/fleet/interactions/{id}/resolve")
    suspend fun resolveInteraction(
        @Path("id") interactionId: String,
        @Body body: Map<String, String>
    ): Response<Any>
}
