package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.CouponResponseData
import com.ayaan.dealora.data.api.models.CreateCouponRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit API interface for coupon endpoints
 */
interface CouponApiService {

    @POST("api/coupons")
    suspend fun createCoupon(@Body request: CreateCouponRequest): Response<ApiResponse<CouponResponseData>>
}

