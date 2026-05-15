package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.PartnerCouponInteractionApiService
import com.ayaan.dealora.data.api.models.PendingPartnerInteraction
import com.ayaan.dealora.data.api.models.RecordPartnerInteractionRequest
import javax.inject.Inject
import javax.inject.Singleton

sealed class PartnerInteractionResult<out T> {
    data class Success<T>(val data: T) : PartnerInteractionResult<T>()
    data class Error(val message: String) : PartnerInteractionResult<Nothing>()
}

@Singleton
class PartnerCouponInteractionRepository @Inject constructor(
    private val api: PartnerCouponInteractionApiService
) {
    companion object { private const val TAG = "PartnerInteractionRepo" }

    /**
     * Record a "discover" (or "redeem") action for a partner coupon.
     * Called when the user taps the Discover button while in exclusive/partner mode.
     */
    suspend fun recordInteraction(
        userId:     String,
        couponId:   String,
        brandName:  String,
        couponCode: String?,
        couponLink: String?,
        action:     String    // "discover" | "redeem"
    ): PartnerInteractionResult<String> {
        return try {
            val response = api.recordInteraction(
                RecordPartnerInteractionRequest(
                    userId     = userId,
                    couponId   = couponId,
                    brandName  = brandName,
                    couponCode = couponCode,
                    couponLink = couponLink,
                    action     = action
                )
            )
            if (response.isSuccessful) {
                val id = response.body()?.data?.interactionId ?: "ok"
                PartnerInteractionResult.Success(id)
            } else {
                PartnerInteractionResult.Error("Failed to record partner interaction: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "recordInteraction error", e)
            PartnerInteractionResult.Error(e.message ?: "Network error")
        }
    }

    /**
     * Fetch all PENDING partner coupon interactions for this user.
     * Called on app open — the result drives the feedback popup.
     */
    suspend fun getPendingInteractions(userId: String): PartnerInteractionResult<List<PendingPartnerInteraction>> {
        return try {
            val response = api.getPendingInteractions(userId)
            if (response.isSuccessful) {
                val interactions = response.body()?.data?.interactions ?: emptyList()
                PartnerInteractionResult.Success(interactions)
            } else {
                PartnerInteractionResult.Error("Failed to fetch pending partner interactions: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "getPendingInteractions error", e)
            PartnerInteractionResult.Error(e.message ?: "Network error")
        }
    }

    /**
     * Resolve a pending partner coupon interaction.
     * outcome: "success" → increments successCount on the partnercoupon
     *          "failure" → increments failedCount
     *          "skipped" → no stat change, just marks resolved
     */
    suspend fun resolveInteraction(
        interactionId: String,
        outcome:       String   // "success" | "failure" | "skipped"
    ): PartnerInteractionResult<Unit> {
        return try {
            val response = api.resolveInteraction(
                interactionId = interactionId,
                body          = mapOf("outcome" to outcome)
            )
            if (response.isSuccessful) PartnerInteractionResult.Success(Unit)
            else PartnerInteractionResult.Error("Resolve failed: ${response.code()}")
        } catch (e: Exception) {
            Log.e(TAG, "resolveInteraction error", e)
            PartnerInteractionResult.Error(e.message ?: "Network error")
        }
    }
}
