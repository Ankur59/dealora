package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.BackendResult
import com.ayaan.dealora.data.api.ProfileApiService
import javax.inject.Inject

/**
 * Repository for fetching user profile data
 */
class ProfileRepository @Inject constructor(
    private val profileApiService: ProfileApiService
) {

    companion object {
        private const val TAG = "ProfileRepository"
    }

    /**
     * Fetch user profile from backend
     */
    suspend fun getProfile(uid: String): BackendResult {
        return try {
            Log.d(TAG, "getProfile: Fetching profile for uid: $uid")

            val response = profileApiService.getProfile(uid)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    Log.d(TAG, "getProfile: Success - ${body.message}")
                    BackendResult.Success(
                        message = body.message,
                        data = body.data
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to fetch profile"
                    Log.e(TAG, "getProfile: Failed - $errorMsg")
                    BackendResult.Error(errorMsg)
                }
            } else {
                val errorMsg = when (response.code()) {
                    401 -> "Unauthorized. Please login again."
                    404 -> "User not found"
                    else -> "Server error: ${response.code()} - ${response.message()}"
                }
                Log.e(TAG, "getProfile: $errorMsg")
                BackendResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "getProfile: Exception occurred", e)
            BackendResult.Error(
                message = "Network error: ${e.localizedMessage ?: "Unknown error"}",
                throwable = e
            )
        }
    }

    /**
     * Update user profile on backend
     */
    suspend fun updateProfile(uid: String, updateData: Map<String, Any>): BackendResult {
        return try {
            Log.d(TAG, "updateProfile: Updating profile for uid: $uid with data: $updateData")

            val response = profileApiService.updateProfile(uid, updateData)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    Log.d(TAG, "updateProfile: Success - ${body.message}")
                    BackendResult.Success(
                        message = body.message,
                        data = body.data
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to update profile"
                    Log.e(TAG, "updateProfile: Failed - $errorMsg")
                    BackendResult.Error(errorMsg)
                }
            } else {
                val errorMsg = when (response.code()) {
                    400 -> {
                        val body = response.errorBody()?.string()
                        body ?: "Validation failed"
                    }
                    409 -> "Email already exists"
                    else -> "Server error: ${response.code()} - ${response.message()}"
                }
                Log.e(TAG, "updateProfile: $errorMsg")
                BackendResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "updateProfile: Exception occurred", e)
            BackendResult.Error(
                message = "Network error: ${e.localizedMessage ?: "Unknown error"}",
                throwable = e
            )
        }
    }
}

