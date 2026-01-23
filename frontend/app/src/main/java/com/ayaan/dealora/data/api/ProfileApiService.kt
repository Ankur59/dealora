package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.AuthResponseData
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Query

/**
 * Retrofit API interface for profile endpoints
 */
interface ProfileApiService {

    @GET("api/auth/profile")
    suspend fun getProfile(@Query("uid") uid: String): Response<ApiResponse<AuthResponseData>>

    @PUT("api/auth/profile")
    suspend fun updateProfile(
        @Query("uid") uid: String,
        @Body updateData: Map<String, @JvmSuppressWildcards Any>
    ): Response<ApiResponse<AuthResponseData>>
}

