package com.ayaan.dealora.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.ayaan.dealora.data.local.dao.SyncedAppDao
import com.ayaan.dealora.data.local.entity.SyncedAppEntity

@Database(
    entities = [SyncedAppEntity::class],
    version = 1,
    exportSchema = false
)
abstract class DealoraDatabase : RoomDatabase() {
    abstract fun syncedAppDao(): SyncedAppDao
}
