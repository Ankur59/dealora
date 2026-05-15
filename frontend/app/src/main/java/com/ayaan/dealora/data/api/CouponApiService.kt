package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.CouponDetailResponseData
import com.ayaan.dealora.data.api.models.CouponListResponseData
import com.ayaan.dealora.data.api.models.CouponResponseData
import com.ayaan.dealora.data.api.models.CouponStatistics
import com.ayaan.dealora.data.api.models.CouponStatisticsRequest
import com.ayaan.dealora.data.api.models.CreateCouponRequest
import com.ayaan.dealora.data.api.models.ExclusiveCouponDetailResponseData
import com.ayaan.dealora.data.api.models.RawCouponListResponseData
import com.ayaan.dealora.data.api.models.ExclusiveCouponListResponseData
import com.ayaan.dealora.data.api.models.PartnerCouponListResponseData
import com.ayaan.dealora.data.api.models.PartnerCouponRedeemResponseData
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
        @Path("couponId") couponId: String, @Query("uid") uid: String
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

    @POST("api/private-coupons/statistics")
    suspend fun getPrivateCouponStatistics(
        @Body request: CouponStatisticsRequest
    ): Response<ApiResponse<CouponStatistics>>

    // Exclusive coupons endpoints
    @GET("api/exclusive-coupons")
    suspend fun getExclusiveCoupons(
        @Query("brands") brands: String? = null,
        @Query("brand") brand: String? = null,
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("source") source: String? = null,
        @Query("stackable") stackable: String? = null,
        @Query("validity") validity: String? = null,
        @Query("sortBy") sortBy: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("page") page: Int? = null
    ): Response<ApiResponse<ExclusiveCouponListResponseData>>

    @GET("api/exclusive-coupons/{couponCode}")
    suspend fun getExclusiveCouponByCode(
        @Path("couponCode") couponCode: String
    ): Response<ApiResponse<ExclusiveCouponDetailResponseData>>

    // Raw scraped coupons endpoint (exclusive / discover mode)
    @GET("api/raw-coupons")
    suspend fun getRawCoupons(
        @Query("category") category: String? = null,
        @Query("brand") brand: String? = null,
        @Query("search") search: String? = null,
        @Query("discountType") discountType: String? = null,
        @Query("validity") validity: String? = null,
        @Query("sortBy") sortBy: String? = null,
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<ApiResponse<RawCouponListResponseData>>

    // ── Partner coupons (exclusive toggle — sourced from ai-coupon-engine) ──────────

    /** Active or expired partner coupons, sorted by discountWeight DESC by default. */
    @GET("api/partner-coupons")
    suspend fun getPartnerCoupons(
        @Query("category")      category:     String? = null,
        @Query("brand")         brand:        String? = null,
        @Query("search")        search:       String? = null,
        @Query("sortBy")        sortBy:       String? = null,
        @Query("discountType")  discountType: String? = null,
        @Query("validity")      validity:     String? = null,
        @Query("page")          page:         Int?    = null,
        @Query("limit")         limit:        Int?    = null,
        @Query("tab")           tab:          String? = null,  // "active" | "expired"
        @Query("offerType")     offerType:    String? = null   // "Coupon" | "Offer"
    ): Response<ApiResponse<PartnerCouponListResponseData>>

    /** Partner coupons this user has already redeemed. */
    @GET("api/partner-coupons/redeemed")
    suspend fun getRedeemedPartnerCoupons(
        @Query("page")  page:  Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<ApiResponse<PartnerCouponListResponseData>>

    /** Mark a partner coupon as redeemed — writes to Redemption collection. */
    @POST("api/partner-coupons/{id}/redeem")
    suspend fun redeemPartnerCoupon(
        @Path("id") couponId: String
    ): Response<ApiResponse<PartnerCouponRedeemResponseData>>

    /** Directly update success/failed counts for a partner coupon (immediate feedback). */
    @POST("api/partner-coupons/{id}/vote")
    suspend fun votePartnerCoupon(
        @Path("id") couponId: String,
        @Body body: Map<String, String> // { "outcome": "success" | "failure" }
    ): Response<ApiResponse<Any>>

    /** Track a Discover button click for trend analytics. */
    @POST("api/partner-coupons/{id}/discover")
    suspend fun trackPartnerDiscover(
        @Path("id") couponId: String
    ): Response<ApiResponse<Any>>
}