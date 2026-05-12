package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.TermsApiService
import com.ayaan.dealora.data.api.models.TermsAcceptRequest

sealed class TermsAcceptResult {
    data class Success(val acceptedAt: String?) : TermsAcceptResult()
    data class Error(val message: String) : TermsAcceptResult()
}

class TermsRepository(
    private val termsApiService: TermsApiService
) {
    companion object {
        private const val TAG = "TermsRepository"
    }

    /**
     * Records that [userId] (Firebase UID) has accepted [termsVersion].
     * Returns [TermsAcceptResult.Success] on success.
     */
    suspend fun acceptTerms(userId: String, termsVersion: String): TermsAcceptResult {
        return try {
            val response = termsApiService.acceptTerms(
                TermsAcceptRequest(userId = userId, termsVersion = termsVersion)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Log.d(TAG, "Terms v$termsVersion accepted for user $userId")
                TermsAcceptResult.Success(response.body()?.acceptedAt)
            } else {
                val msg = response.body()?.message ?: response.message() ?: "Failed to accept terms"
                Log.e(TAG, "acceptTerms failed: $msg")
                TermsAcceptResult.Error(msg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "acceptTerms exception: ${e.message}", e)
            TermsAcceptResult.Error(e.message ?: "Network error")
        }
    }
}
