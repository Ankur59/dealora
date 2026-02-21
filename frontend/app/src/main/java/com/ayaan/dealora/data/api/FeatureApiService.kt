package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.GmailSyncRequest
import com.ayaan.dealora.data.api.models.GmailSyncResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit interface for /api/features endpoints.
 */
interface FeatureApiService {

    @POST("api/features/gmail-sync")
    suspend fun syncGmail(
        @Body request: GmailSyncRequest
    ): Response<GmailSyncResponse>
}
