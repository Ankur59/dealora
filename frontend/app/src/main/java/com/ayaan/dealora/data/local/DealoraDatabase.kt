package com.ayaan.dealora.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.ayaan.dealora.data.local.dao.SyncedAppDao
import com.ayaan.dealora.data.local.dao.SavedCouponDao
import com.ayaan.dealora.data.local.entity.SyncedAppEntity
import com.ayaan.dealora.data.local.entity.SavedCouponEntity

@Database(
    entities = [SyncedAppEntity::class, SavedCouponEntity::class],
    version = 2,
    exportSchema = false
)
abstract class DealoraDatabase : RoomDatabase() {
    abstract fun syncedAppDao(): SyncedAppDao
    abstract fun savedCouponDao(): SavedCouponDao
}
