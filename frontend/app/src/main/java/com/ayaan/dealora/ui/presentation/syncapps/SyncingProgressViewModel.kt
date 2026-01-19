package com.ayaan.dealora.ui.presentation.syncapps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.repository.SyncedAppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SyncingProgressViewModel @Inject constructor(
    private val syncedAppRepository: SyncedAppRepository
) : ViewModel() {

    fun saveSyncedApp(appId: String, appName: String) {
        viewModelScope.launch {
            syncedAppRepository.insertSyncedApp(appId, appName)
        }
    }

    fun saveSyncedApps(apps: List<Pair<String, String>>) {
        viewModelScope.launch {
            syncedAppRepository.insertSyncedApps(apps)
        }
    }
}