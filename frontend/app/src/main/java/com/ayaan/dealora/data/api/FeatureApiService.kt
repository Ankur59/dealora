package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.GmailSyncRequest
import com.ayaan.dealora.data.api.models.GmailSyncResponse
import com.ayaan.dealora.data.api.models.OcrRequest
import com.ayaan.dealora.data.api.models.OcrResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit API service for special features like OCR and Email parsing
 */
interface FeatureApiService {

    @POST("api/features/gmail-sync")
    suspend fun syncGmail(
        @Body request: GmailSyncRequest
    ): Response<GmailSyncResponse>

    @POST("api/features/ocr")
    suspend fun processOcr(
        @Body request: OcrRequest
    ): Response<OcrResponse>

    @POST("api/features/status")
    suspend fun checkStatus(): Response<Unit>
}