package com.ayaan.dealora.data.repository

import android.util.Log
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import com.ayaan.dealora.data.api.CouponApiService
import com.ayaan.dealora.data.api.models.Coupon
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.data.api.models.CouponListItem
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
     * Sync private coupons based on selected brands
     */
    suspend fun syncPrivateCoupons(brands: List<String>): PrivateCouponResult {
        return try {
            Log.d(TAG, "Syncing private coupons for brands: ${brands.joinToString()}")
            val request = SyncPrivateCouponsRequest(brands)
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
    suspend fun getPrivateCouponById(couponId: String): PrivateCoupon? {
        return try {
            Log.d(TAG, "Fetching private coupon with id: $couponId")
            val brands = listOf("Zomato", "Swiggy", "Amazon", "Flipkart", "Myntra", "Ajio")
            val result = syncPrivateCoupons(brands)

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

