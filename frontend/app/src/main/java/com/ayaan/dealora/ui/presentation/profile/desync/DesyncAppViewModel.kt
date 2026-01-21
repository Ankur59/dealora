package com.ayaan.dealora.ui.presentation.profile.desync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.local.entity.SyncedAppEntity
import com.ayaan.dealora.data.repository.SyncedAppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DesyncAppViewModel @Inject constructor(
    private val syncedAppRepository: SyncedAppRepository
) : ViewModel() {

    private val _syncedApps = MutableStateFlow<List<SyncedAppEntity>>(emptyList())
    val syncedApps: StateFlow<List<SyncedAppEntity>> = _syncedApps.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadSyncedApps()
    }

    private fun loadSyncedApps() {
        viewModelScope.launch {
            _isLoading.value = true
            syncedAppRepository.getAllSyncedApps().collect { apps ->
                _syncedApps.value = apps
                _isLoading.value = false
            }
        }
    }

    fun removeSyncedApp(appId: String) {
        viewModelScope.launch {
            syncedAppRepository.deleteSyncedApp(appId)
        }
    }
}
