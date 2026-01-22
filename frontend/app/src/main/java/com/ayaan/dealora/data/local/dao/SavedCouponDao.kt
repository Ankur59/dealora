package com.ayaan.dealora.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Delete
import com.ayaan.dealora.data.local.entity.SavedCouponEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SavedCouponDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveCoupon(coupon: SavedCouponEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveCoupons(coupons: List<SavedCouponEntity>)

    @Query("SELECT * FROM saved_coupons ORDER BY savedAt DESC")
    fun getAllSavedCoupons(): Flow<List<SavedCouponEntity>>

    @Query("SELECT * FROM saved_coupons WHERE couponType = :couponType ORDER BY savedAt DESC")
    fun getSavedCouponsByType(couponType: String): Flow<List<SavedCouponEntity>>

    @Query("SELECT * FROM saved_coupons WHERE couponId = :couponId")
    suspend fun getSavedCouponById(couponId: String): SavedCouponEntity?

    @Query("SELECT EXISTS(SELECT 1 FROM saved_coupons WHERE couponId = :couponId)")
    suspend fun isCouponSaved(couponId: String): Boolean

    @Query("DELETE FROM saved_coupons WHERE couponId = :couponId")
    suspend fun deleteSavedCoupon(couponId: String)

    @Delete
    suspend fun deleteSavedCouponEntity(coupon: SavedCouponEntity)

    @Query("DELETE FROM saved_coupons")
    suspend fun deleteAllSavedCoupons()
}
