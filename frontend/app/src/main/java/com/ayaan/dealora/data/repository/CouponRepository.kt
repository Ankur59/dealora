package com.ayaan.dealora.data.repository

import android.util.Log
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import com.ayaan.dealora.data.api.CouponApiService
import com.ayaan.dealora.data.api.models.Coupon
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.CouponListResponseData
import com.ayaan.dealora.data.api.models.CouponStatistics
import com.ayaan.dealora.data.api.models.CreateCouponRequest
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.SyncPrivateCouponsRequest
import com.ayaan.dealora.data.paging.CouponPagingSource
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/**
 * Sealed class representing coupon API call results
 */
sealed class CouponResult {
    data class Success(
        val message: String,
        val coupon: Coupon,
        val couponImageBase64: String? = null
    ) : CouponResult()

    data class Error(
        val message: String
    ) : CouponResult()
}

/**
 * Repository for coupon-related backend API calls
 */
class CouponRepository @Inject constructor(
    private val couponApiService: CouponApiService
) {
    companion object {
        private const val TAG = "CouponRepository"
    }

    /**
     * Get paginated coupons as Flow<PagingData>
     */
    fun getCoupons(
        uid: String,
        status: String = "active",
        brand: String? = null,
        category: String? = null,
        discountType: String? = null,
        price: String? = null,
        validity: String? = null,
        search: String? = null,
        sortBy: String? = null
    ): Flow<PagingData<CouponListItem>> {
        Log.d(TAG, "Getting coupons for uid: $uid with status: $status, search: $search, sortBy: $sortBy")
        return Pager(
            config = PagingConfig(
                pageSize = CouponPagingSource.PAGE_SIZE,
                enablePlaceholders = false,
                initialLoadSize = CouponPagingSource.PAGE_SIZE
            ),
            pagingSourceFactory = {
                CouponPagingSource(
                    couponApiService = couponApiService,
                    uid = uid,
                    status = status,
                    brand = brand,
                    category = category,
                    discountType = discountType,
                    price = price,
                    validity = validity,
                    search = search,
                    sortBy = sortBy
                )
            }
        ).flow
    }

    /**
     * Get coupons for a specific category with count
     */
    suspend fun getCouponsByCategory(
        uid: String,
        category: String,
        limit: Int = 10
    ): CouponListResponseData? {
        return try {
            Log.d(TAG, "Getting coupons for category: $category, limit: $limit")
            val response = couponApiService.getCoupons(uid = uid, page = 1, limit = limit, category = category)
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    body.data
                } else {
                    null
                }
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting coupons by category", e)
            null
        }
    }

    /**
     * Create a new coupon
     */
    suspend fun createCoupon(request: CreateCouponRequest): CouponResult {
        return try {
            Log.d(TAG, "Creating coupon: ${request.couponName}")
            val response = couponApiService.createCoupon(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    Log.d(TAG, "Coupon created successfully: ${body.data.coupon.id}")
                    Log.d(TAG, "API response - couponImageBase64 present: ${body.data.couponImageBase64 != null}")
                    Log.d(TAG, "API response - couponImageBase64 length: ${body.data.couponImageBase64?.length ?: 0}")
                    CouponResult.Success(
                        message = body.message,
                        coupon = body.data.coupon,
                        couponImageBase64 = body.data.couponImageBase64
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to create coupon"
                    Log.e(TAG, "Create coupon failed: $errorMsg")
                    CouponResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                Log.e(TAG, "Create coupon HTTP error: $errorMsg")
                CouponResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Create coupon exception", e)
            CouponResult.Error(e.message ?: "Network error occurred")
        }
    }

    /**
     * Get coupon details by ID
     */
    suspend fun getCouponById(couponId: String, uid: String): CouponDetailResult {
        return try {
            Log.d(TAG, "Fetching coupon details for id: $couponId, uid: $uid")
            val response = couponApiService.getCouponById(couponId, uid)

            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    Log.d(TAG, "Coupon details fetched successfully: ${body.data.coupon.id}")
                    CouponDetailResult.Success(
                        message = body.message,
                        coupon = body.data.coupon
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to fetch coupon details"
                    Log.e(TAG, "Fetch coupon details failed: $errorMsg")
                    CouponDetailResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                Log.e(TAG, "Fetch coupon details HTTP error: $errorMsg")
                CouponDetailResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fetch coupon details exception", e)
            CouponDetailResult.Error(e.message ?: "Network error occurred")
        }
    }

    /**
     * Sync private coupons with filter support
     */
    suspend fun syncPrivateCoupons(
        brands: List<String>,
        category: String? = null,
        search: String? = null,
        discountType: String? = null,
        price: String? = null,
        validity: String? = null,
        sortBy: String? = null,
        page: Int? = null,
        limit: Int? = null
    ): PrivateCouponResult {
        return try {
            Log.d(TAG, "Syncing private coupons for brands: $brands, search: $search, category: $category, sortBy: $sortBy")
            val request = SyncPrivateCouponsRequest(
                brands = brands,
                category = category,
                search = search,
                discountType = discountType,
                price = price,
                validity = validity,
                sortBy = sortBy,
                page = page,
                limit = limit
            )
            val response = couponApiService.syncPrivateCoupons(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    Log.d(TAG, "Private coupons synced successfully: ${body.data.count} coupons")
                    PrivateCouponResult.Success(
                        message = body.message,
                        coupons = body.data.coupons
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to sync private coupons"
                    Log.e(TAG, "Sync private coupons failed: $errorMsg")
                    PrivateCouponResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                Log.e(TAG, "Sync private coupons HTTP error: $errorMsg")
                PrivateCouponResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync private coupons exception", e)
            PrivateCouponResult.Error(e.message ?: "Network error occurred")
        }
    }

    /**
     * Get a single private coupon by ID from the synced list
     * Note: This fetches all private coupons and filters by ID
     */
    suspend fun getPrivateCouponById(couponId: String, brands: List<String>): PrivateCoupon? {
        return try {
            Log.d(TAG, "Fetching private coupon with id: $couponId")
            val result = syncPrivateCoupons(
                brands = brands,
                category = null,
                search = null,
                discountType = null,
                price = null,
                validity = null,
                sortBy = null,
                page = null,
                limit = null
            )

            when (result) {
                is PrivateCouponResult.Success -> {
                    result.coupons.firstOrNull { it.id == couponId }
                }
                is PrivateCouponResult.Error -> {
                    Log.e(TAG, "Error fetching private coupon: ${result.message}")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception fetching private coupon", e)
            null
        }
    }

    /**
     * Redeem a private coupon
     */
    suspend fun redeemPrivateCoupon(couponId: String, uid: String): PrivateCouponResult {
        return try {
            Log.d(TAG, "Redeeming private coupon: $couponId for uid: $uid")
            val response = couponApiService.redeemPrivateCoupon(couponId, uid)

            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    Log.d(TAG, "Private coupon redeemed successfully")
                    PrivateCouponResult.Success(
                        message = body.message,
                        coupons = listOf(body.data.coupon)
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to redeem private coupon"
                    Log.e(TAG, "Redeem private coupon failed: $errorMsg")
                    PrivateCouponResult.Error(errorMsg)
                }
            } else {
                val errorMsg = when (response.code()) {
                    400 -> "Coupon is already redeemed or not redeemable"
                    404 -> "Private coupon not found"
                    else -> "HTTP ${response.code()}: ${response.message()}"
                }
                Log.e(TAG, "Redeem private coupon HTTP error: $errorMsg")
                PrivateCouponResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Redeem private coupon exception", e)
            PrivateCouponResult.Error(e.message ?: "Network error occurred")
        }
    }

    /**
     * Get private coupon statistics with brand filtering
     */
    suspend fun getPrivateCouponStatistics(brands: List<String> = emptyList()): PrivateCouponStatisticsResult {
        return try {
            Log.d(TAG, "Fetching private coupon statistics for brands: $brands")
            val request = com.ayaan.dealora.data.api.models.CouponStatisticsRequest(brands)
            val response = couponApiService.getPrivateCouponStatistics(request)
 
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    Log.d(TAG, "Private coupon statistics fetched successfully")
                    PrivateCouponStatisticsResult.Success(
                        message = body.message,
                        statistics = body.data
                    )
                } else {
                    val errorMsg = body?.message ?: "Failed to fetch statistics"
                    Log.e(TAG, "Fetch statistics failed: $errorMsg")
                    PrivateCouponStatisticsResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                Log.e(TAG, "Fetch statistics HTTP error: $errorMsg")
                PrivateCouponStatisticsResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fetch statistics exception", e)
            PrivateCouponStatisticsResult.Error(e.message ?: "Network error occurred")
        }
    }
}

/**
 * Sealed class representing coupon detail API call results
 */
sealed class CouponDetailResult {
    data class Success(
        val message: String,
        val coupon: CouponDetail
    ) : CouponDetailResult()

    data class Error(
        val message: String
    ) : CouponDetailResult()
}

/**
 * Sealed class representing private coupon API call results
 */
sealed class PrivateCouponResult {
    data class Success(
        val message: String,
        val coupons: List<PrivateCoupon>
    ) : PrivateCouponResult()

    data class Error(
        val message: String
    ) : PrivateCouponResult()
}

/**
 * Sealed class representing private coupon statistics API call results
 */
sealed class PrivateCouponStatisticsResult {
    data class Success(
        val message: String,
        val statistics: CouponStatistics
    ) : PrivateCouponStatisticsResult()

    data class Error(
        val message: String
    ) : PrivateCouponStatisticsResult()
}

