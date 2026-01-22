package com.ayaan.dealora.ui.presentation.syncapps.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.repository.SyncedAppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SelectAppsViewModel @Inject constructor(
    private val syncedAppRepository: SyncedAppRepository
) : ViewModel() {

    private val _syncedAppIds = MutableStateFlow<Set<String>>(emptySet())
    val syncedAppIds: StateFlow<Set<String>> = _syncedAppIds.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadSyncedApps()
    }

    private fun loadSyncedApps() {
        viewModelScope.launch {
            _isLoading.value = true
            syncedAppRepository.getAllSyncedApps().collect { apps ->
                _syncedAppIds.value = apps.map { it.appId.lowercase() }.toSet()
                _isLoading.value = false
            }
        }
    }
}
