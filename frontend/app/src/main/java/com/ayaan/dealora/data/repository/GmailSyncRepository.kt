package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.FeatureApiService
import com.ayaan.dealora.data.api.models.GmailExtractedCoupon
import com.ayaan.dealora.data.api.models.GmailSyncRequest
import javax.inject.Inject

sealed class GmailSyncResult {
    data class Success(
        val message: String,
        val extractedCount: Int,
        val skippedCount: Int,
        val coupons: List<GmailExtractedCoupon>
    ) : GmailSyncResult()

    data class Error(val message: String) : GmailSyncResult()
}

class GmailSyncRepository @Inject constructor(
    private val featureApiService: FeatureApiService
) {
    companion object {
        private const val TAG = "GmailSyncRepository"
    }

    suspend fun syncGmail(accessToken: String, userId: String): GmailSyncResult {
        return try {
            Log.d(TAG, "Calling gmail-sync with userId: $userId")
            val response = featureApiService.syncGmail(
                GmailSyncRequest(accessToken = accessToken, userId = userId)
            )
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    Log.d(TAG, "Gmail sync successful: ${body.extractedCount} coupons extracted")
                    GmailSyncResult.Success(
                        message = body.message,
                        extractedCount = body.extractedCount ?: 0,
                        skippedCount = body.skippedCount ?: 0,
                        coupons = body.coupons ?: emptyList()
                    )
                } else {
                    val errorMsg = body?.message ?: "Gmail sync failed"
                    Log.e(TAG, "Gmail sync failed: $errorMsg")
                    GmailSyncResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                Log.e(TAG, "Gmail sync HTTP error: $errorMsg")
                GmailSyncResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gmail sync exception", e)
            GmailSyncResult.Error(e.message ?: "Network error occurred")
        }
    }
}
