package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.FleetApiService
import com.ayaan.dealora.data.api.models.PendingInteraction
import com.ayaan.dealora.data.api.models.RecordInteractionRequest
import javax.inject.Inject
import javax.inject.Singleton

sealed class FleetResult<out T> {
    data class Success<T>(val data: T) : FleetResult<T>()
    data class Error(val message: String) : FleetResult<Nothing>()
}

@Singleton
class FleetRepository @Inject constructor(
    private val fleetApiService: FleetApiService
) {
    companion object { private const val TAG = "FleetRepository" }

    /** Record a copy / discover / redeem interaction */
    suspend fun recordInteraction(
        userId: String,
        couponId: String,
        brandName: String,
        couponCode: String?,
        couponLink: String?,
        action: String               // "copy" | "discover" | "redeem"
    ): FleetResult<String> {
        return try {
            val response = fleetApiService.recordInteraction(
                RecordInteractionRequest(
                    userId = userId,
                    couponId = couponId,
                    brandName = brandName,
                    couponCode = couponCode,
                    couponLink = couponLink,
                    action = action
                )
            )
            if (response.isSuccessful) {
                val id = response.body()?.data?.interactionId ?: "ok"
                FleetResult.Success(id)
            } else {
                FleetResult.Error("Failed to record interaction: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "recordInteraction error", e)
            FleetResult.Error(e.message ?: "Network error")
        }
    }

    /** Fetch all PENDING interactions for the given user */
    suspend fun getPendingInteractions(userId: String): FleetResult<List<PendingInteraction>> {
        return try {
            val response = fleetApiService.getPendingInteractions(userId)
            if (response.isSuccessful) {
                val interactions = response.body()?.data?.interactions ?: emptyList()
                FleetResult.Success(interactions)
            } else {
                FleetResult.Error("Failed to fetch pending interactions: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "getPendingInteractions error", e)
            FleetResult.Error(e.message ?: "Network error")
        }
    }

    /** Resolve a pending interaction */
    suspend fun resolveInteraction(
        interactionId: String,
        outcome: String              // "success" | "failure" | "skipped"
    ): FleetResult<Unit> {
        return try {
            val response = fleetApiService.resolveInteraction(
                interactionId = interactionId,
                body = mapOf("outcome" to outcome)
            )
            if (response.isSuccessful) FleetResult.Success(Unit)
            else FleetResult.Error("Resolve failed: ${response.code()}")
        } catch (e: Exception) {
            Log.e(TAG, "resolveInteraction error", e)
            FleetResult.Error(e.message ?: "Network error")
        }
    }
}
