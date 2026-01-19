package com.ayaan.dealora.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Delete
import com.ayaan.dealora.data.local.entity.SyncedAppEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SyncedAppDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSyncedApp(app: SyncedAppEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSyncedApps(apps: List<SyncedAppEntity>)

    @Query("SELECT * FROM synced_apps ORDER BY syncedAt DESC")
    fun getAllSyncedApps(): Flow<List<SyncedAppEntity>>

    @Query("SELECT * FROM synced_apps WHERE appId = :appId")
    suspend fun getSyncedAppById(appId: String): SyncedAppEntity?

    @Query("SELECT EXISTS(SELECT 1 FROM synced_apps WHERE appId = :appId)")
    suspend fun isAppSynced(appId: String): Boolean

    @Delete
    suspend fun deleteSyncedApp(app: SyncedAppEntity)

    @Query("DELETE FROM synced_apps WHERE appId = :appId")
    suspend fun deleteSyncedAppById(appId: String)

    @Query("DELETE FROM synced_apps")
    suspend fun deleteAllSyncedApps()

    @Query("SELECT COUNT(*) FROM synced_apps")
    suspend fun getSyncedAppsCount(): Int
}
