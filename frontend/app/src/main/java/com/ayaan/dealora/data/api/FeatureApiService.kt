package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.FeatureStatusResponse
import com.ayaan.dealora.data.api.models.GmailSyncRequest
import com.ayaan.dealora.data.api.models.GmailSyncResponse
import com.ayaan.dealora.data.api.models.OcrRequest
import com.ayaan.dealora.data.api.models.OcrResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface FeatureApiService {

    @POST("api/features/ocr")
    suspend fun processScreenshot(@Body request: OcrRequest): Response<OcrResponse>

    @POST("api/features/gmail-sync")
    suspend fun syncGmail(@Body request: GmailSyncRequest): Response<GmailSyncResponse>

    @GET("api/features/status")
    suspend fun getServiceStatus(): Response<FeatureStatusResponse>

    @GET("api/features/ocr")
    suspend fun getOcrHistory(): Response<OcrResponse> // Returns list format usually, but keeping it simple for now
}
