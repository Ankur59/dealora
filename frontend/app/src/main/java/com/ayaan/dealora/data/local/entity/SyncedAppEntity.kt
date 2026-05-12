package com.ayaan.dealora.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "synced_apps")
data class SyncedAppEntity(
    @PrimaryKey
    val appId: String,
    val appName: String,
    val syncedAt: Long = System.currentTimeMillis()
)
