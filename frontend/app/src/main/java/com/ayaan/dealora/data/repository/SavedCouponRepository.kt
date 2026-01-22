package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.local.dao.SavedCouponDao
import com.ayaan.dealora.data.local.entity.SavedCouponEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class SavedCouponRepository @Inject constructor(
    private val savedCouponDao: SavedCouponDao
) {
    companion object {
        private const val TAG = "SavedCouponRepository"
    }

    /**
     * Save a coupon's JSON body to local database
     */
    suspend fun saveCoupon(
        couponId: String,
        couponJson: String,
        couponType: String = "private"
    ) {
        try {
            val savedCoupon = SavedCouponEntity(
                couponId = couponId,
                couponJson = couponJson,
                couponType = couponType
            )
            savedCouponDao.saveCoupon(savedCoupon)
            Log.d(TAG, "Coupon saved: $couponId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving coupon: $couponId", e)
        }
    }

    /**
     * Remove a saved coupon from local database
     */
    suspend fun removeSavedCoupon(couponId: String) {
        try {
            savedCouponDao.deleteSavedCoupon(couponId)
            Log.d(TAG, "Coupon removed: $couponId")
        } catch (e: Exception) {
            Log.e(TAG, "Error removing coupon: $couponId", e)
        }
    }

    /**
     * Check if a coupon is saved
     */
    suspend fun isCouponSaved(couponId: String): Boolean {
        return try {
            savedCouponDao.isCouponSaved(couponId)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if coupon is saved: $couponId", e)
            false
        }
    }

    /**
     * Get all saved coupons as a flow
     */
    fun getAllSavedCoupons(): Flow<List<SavedCouponEntity>> {
        return savedCouponDao.getAllSavedCoupons()
    }

    /**
     * Get saved coupons by type (private or public) as a flow
     */
    fun getSavedCouponsByType(couponType: String): Flow<List<SavedCouponEntity>> {
        return savedCouponDao.getSavedCouponsByType(couponType)
    }

    /**
     * Get a specific saved coupon
     */
    suspend fun getSavedCouponById(couponId: String): SavedCouponEntity? {
        return try {
            savedCouponDao.getSavedCouponById(couponId)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting saved coupon: $couponId", e)
            null
        }
    }
}
