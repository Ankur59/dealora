package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.CouponApiService
import com.ayaan.dealora.data.api.models.Coupon
import com.ayaan.dealora.data.api.models.CreateCouponRequest
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
}

