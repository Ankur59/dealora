package com.ayaan.dealora.data.repository

import com.ayaan.dealora.data.local.dao.SyncedAppDao
import com.ayaan.dealora.data.local.entity.SyncedAppEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncedAppRepository @Inject constructor(
    private val syncedAppDao: SyncedAppDao
) {

    fun getAllSyncedApps(): Flow<List<SyncedAppEntity>> {
        return syncedAppDao.getAllSyncedApps()
    }

    suspend fun insertSyncedApp(appId: String, appName: String) {
        val syncedApp = SyncedAppEntity(
            appId = appId,
            appName = appName
        )
        syncedAppDao.insertSyncedApp(syncedApp)
    }

    suspend fun insertSyncedApps(apps: List<Pair<String, String>>) {
        val syncedApps = apps.map { (id, name) ->
            SyncedAppEntity(appId = id, appName = name)
        }
        syncedAppDao.insertSyncedApps(syncedApps)
    }

    suspend fun getSyncedAppById(appId: String): SyncedAppEntity? {
        return syncedAppDao.getSyncedAppById(appId)
    }

    suspend fun isAppSynced(appId: String): Boolean {
        return syncedAppDao.isAppSynced(appId)
    }

    suspend fun deleteSyncedApp(appId: String) {
        syncedAppDao.deleteSyncedAppById(appId)
    }

    suspend fun deleteAllSyncedApps() {
        syncedAppDao.deleteAllSyncedApps()
    }

    suspend fun getSyncedAppsCount(): Int {
        return syncedAppDao.getSyncedAppsCount()
    }
}
