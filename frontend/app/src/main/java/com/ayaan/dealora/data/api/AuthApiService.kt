package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.AuthResponseData
import com.ayaan.dealora.data.api.models.DeleteFcmTokenRequest
import com.ayaan.dealora.data.api.models.DeleteFcmTokenResponse
import com.ayaan.dealora.data.api.models.FcmTokenRequest
import com.ayaan.dealora.data.api.models.FcmTokenResponse
import com.ayaan.dealora.data.api.models.LoginRequest
import com.ayaan.dealora.data.api.models.SignupRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.POST

/**
 * Retrofit API interface for authentication endpoints
 */
interface AuthApiService {

    @POST("api/auth/signup")
    suspend fun signup(@Body request: SignupRequest): Response<ApiResponse<AuthResponseData>>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponseData>>

    @POST("api/auth/fcm-token")
    suspend fun updateFcmToken(@Body request: FcmTokenRequest): Response<ApiResponse<FcmTokenResponse>>

    @POST("api/auth/delete-fcm-token")
    suspend fun deleteFcmToken(@Body request: DeleteFcmTokenRequest): Response<ApiResponse<FcmTokenResponse>>
}

