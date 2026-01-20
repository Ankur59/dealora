package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.CouponDetailResponseData
import com.ayaan.dealora.data.api.models.CouponListResponseData
import com.ayaan.dealora.data.api.models.CouponResponseData
import com.ayaan.dealora.data.api.models.CreateCouponRequest
import com.ayaan.dealora.data.api.models.PrivateCouponRedeemResponseData
import com.ayaan.dealora.data.api.models.PrivateCouponResponseData
import com.ayaan.dealora.data.api.models.SyncPrivateCouponsRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit API interface for coupon endpoints
 */
interface CouponApiService {

    @POST("api/coupons")
    suspend fun createCoupon(@Body request: CreateCouponRequest): Response<ApiResponse<CouponResponseData>>

    @GET("api/coupons/test")
    suspend fun getCoupons(
        @Query("uid") uid: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int,
        @Query("status") status: String = "active",
        @Query("brand") brand: String? = null,
        @Query("category") category: String? = null,
        @Query("discountType") discountType: String? = null,
        @Query("price") price: String? = null,
        @Query("validity") validity: String? = null,
        @Query("search") search: String? = null,
        @Query("sortBy") sortBy: String? = null
    ): Response<ApiResponse<CouponListResponseData>>

    @GET("api/coupons/test/{couponId}")
    suspend fun getCouponById(
        @Path("couponId") couponId: String,
        @Query("uid") uid: String
    ): Response<ApiResponse<CouponDetailResponseData>>

    @POST("api/private-coupons/sync")
    suspend fun syncPrivateCoupons(
        @Body request: SyncPrivateCouponsRequest
    ): Response<ApiResponse<PrivateCouponResponseData>>

    @PATCH("api/private-coupons/{couponId}/redeem/")
    suspend fun redeemPrivateCoupon(
        @Path("couponId") couponId: String,
        @Query("uid") uid: String
    ): Response<ApiResponse<PrivateCouponRedeemResponseData>>
}