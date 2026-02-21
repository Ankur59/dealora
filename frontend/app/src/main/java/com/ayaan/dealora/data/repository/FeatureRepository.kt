package com.ayaan.dealora.data.repository

import com.ayaan.dealora.data.api.FeatureApiService
import com.ayaan.dealora.data.api.models.Coupon
import com.ayaan.dealora.data.api.models.OcrRequest
import com.ayaan.dealora.data.api.models.OcrResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

sealed class FeatureResult {
    data class Success(val coupon: Coupon, val confidence: Double?) : FeatureResult()
    data class Error(val message: String) : FeatureResult()
}


/**
 * Repository for handling feature-related operations (OCR, Email Parsing, etc.)
 */
@Singleton
class FeatureRepository @Inject constructor(
    private val apiService: FeatureApiService
) {

    suspend fun processOcr(imageBase64: String, userId: String?): FeatureResult = withContext(Dispatchers.IO) {
        try {
            val response = apiService.processOcr(OcrRequest(imageBase64, userId))
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    FeatureResult.Success(body.data, body.confidence)
                } else {
                    FeatureResult.Error(body?.message ?: "Unknown error occurred")
                }
            } else {
                val errorBody = response.errorBody()?.string()
                val message = try {
                    val json = JSONObject(errorBody ?: "")
                    json.optString("message", "Failed to process OCR")
                } catch (_: Exception) {
                    "Failed to process OCR: ${response.code()}"
                }
                FeatureResult.Error(message)
            }
        } catch (e: Exception) {
            FeatureResult.Error(e.localizedMessage ?: "Network error")
        }
    }
}
