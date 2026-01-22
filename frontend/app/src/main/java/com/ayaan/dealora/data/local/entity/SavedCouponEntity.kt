package com.ayaan.dealora.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "saved_coupons")
data class SavedCouponEntity(
    @PrimaryKey
    val couponId: String,
    val couponJson: String, // The complete coupon JSON body
    val savedAt: Long = System.currentTimeMillis(),
    val couponType: String = "private" // "private" or "public"
)
