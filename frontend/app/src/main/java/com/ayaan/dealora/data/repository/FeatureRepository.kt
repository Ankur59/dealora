package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.FeatureApiService
import com.ayaan.dealora.data.api.models.FeatureStatusResponse
import com.ayaan.dealora.data.api.models.GmailSyncRequest
import com.ayaan.dealora.data.api.models.GmailSyncResponse
import com.ayaan.dealora.data.api.models.OcrRequest
import com.ayaan.dealora.data.api.models.OcrResponse
import javax.inject.Inject

sealed class FeatureResult<out T> {
    data class Success<out T>(val data: T) : FeatureResult<T>()
    data class Error(val message: String) : FeatureResult<Nothing>()
}

class FeatureRepository @Inject constructor(
    private val featureApiService: FeatureApiService
) {
    companion object {
        private const val TAG = "FeatureRepository"
    }

    suspend fun processScreenshot(base64Image: String, userId: String?): FeatureResult<OcrResponse> {
        return try {
            Log.d(TAG, "Processing screenshot with OCR")
            val response = featureApiService.processScreenshot(OcrRequest(base64Image, userId))
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success) {
                    FeatureResult.Success(body)
                } else {
                    FeatureResult.Error(body?.message ?: "OCR processing failed")
                }
            } else {
                FeatureResult.Error("HTTP ${response.code()}: ${response.message()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "OCR exception", e)
            FeatureResult.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun syncGmail(accessToken: String, userId: String?): FeatureResult<GmailSyncResponse> {
        return try {
            Log.d(TAG, "Syncing Gmail coupons")
            val response = featureApiService.syncGmail(GmailSyncRequest(accessToken, userId))
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success) {
                    FeatureResult.Success(body)
                } else {
                    FeatureResult.Error(body?.message ?: "Gmail sync failed")
                }
            } else {
                FeatureResult.Error("HTTP ${response.code()}: ${response.message()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gmail sync exception", e)
            FeatureResult.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun getServiceStatus(): FeatureResult<FeatureStatusResponse> {
        return try {
            val response = featureApiService.getServiceStatus()
            if (response.isSuccessful && response.body() != null) {
                FeatureResult.Success(response.body()!!)
            } else {
                FeatureResult.Error("Failed to get service status")
            }
        } catch (e: Exception) {
            FeatureResult.Error(e.message ?: "Network error occurred")
        }
    }
}
