package com.ayaan.dealora.data.api

import android.util.Log
import com.ayaan.dealora.data.api.models.LoginRequest
import com.ayaan.dealora.data.api.models.SignupRequest
import javax.inject.Inject

/**
 * Repository for making backend API calls
 */
class BackendAuthRepository @Inject constructor(
    private val authApiService: AuthApiService
) {

    companion object {
        private const val TAG = "BackendAuthRepository"
    }

    /**
     * Register a new user in the backend
     */
    suspend fun signup(uid: String, name: String, email: String, phone: String): BackendResult {
        return try {
            Log.d(TAG, "signup: Calling backend signup API for uid: $uid")

            val request = SignupRequest(
                uid = uid,
                name = name,
                email = email,
                phone = phone
            )

            val response = authApiService.signup(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    Log.d(TAG, "signup: Success - ${body.message}")
                    BackendResult.Success(
                        message = body.message,
                        data = body.data
                    )
                } else {
                    val errorMsg = body?.message ?: "Signup failed"
                    Log.e(TAG, "signup: Failed - $errorMsg")
                    BackendResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "Server error: ${response.code()} - ${response.message()}"
                Log.e(TAG, "signup: $errorMsg")
                BackendResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "signup: Exception occurred", e)
            BackendResult.Error(
                message = "Network error: ${e.localizedMessage ?: "Unknown error"}",
                throwable = e
            )
        }
    }

    /**
     * Login an existing user in the backend
     */
    suspend fun login(uid: String): BackendResult {
        return try {
            Log.d(TAG, "login: Calling backend login API for uid: $uid")

            val request = LoginRequest(uid = uid)

            val response = authApiService.login(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    Log.d(TAG, "login: Success - ${body.message}")
                    BackendResult.Success(
                        message = body.message,
                        data = body.data
                    )
                } else {
                    val errorMsg = body?.message ?: "Login failed"
                    Log.e(TAG, "login: Failed - $errorMsg")
                    BackendResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "Server error: ${response.code()} - ${response.message()}"
                Log.e(TAG, "login: $errorMsg")
                BackendResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "login: Exception occurred", e)
            BackendResult.Error(
                message = "Network error: ${e.localizedMessage ?: "Unknown error"}",
                throwable = e
            )
        }
    }
}

