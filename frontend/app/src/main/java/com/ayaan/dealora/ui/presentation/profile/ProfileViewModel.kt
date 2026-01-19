package com.ayaan.dealora.ui.presentation.profile

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.BackendResult
import com.ayaan.dealora.data.repository.ProfileRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    private val firebaseAuth: FirebaseAuth,
    private val syncedAppRepository: com.ayaan.dealora.data.repository.SyncedAppRepository
) : ViewModel() {

    companion object {
        private const val TAG = "ProfileViewModel"
    }

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        fetchProfile()
    }

    fun fetchProfile() {
        val uid = firebaseAuth.currentUser?.uid

        if (uid == null) {
            Log.e(TAG, "fetchProfile: No user logged in")
            _uiState.update {
                it.copy(
                    isLoading = false,
                    errorMessage = "No user logged in. Please login again."
                )
            }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            Log.d(TAG, "fetchProfile: Fetching profile for uid: $uid")

            when (val result = profileRepository.getProfile(uid)) {
                is BackendResult.Success -> {
                    Log.d(TAG, "fetchProfile: Success - ${result.data.user.name}")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            user = result.data.user,
                            errorMessage = null
                        )
                    }
                }
                is BackendResult.Error -> {
                    Log.e(TAG, "fetchProfile: Error - ${result.message}")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun retry() {
        fetchProfile()
    }

    fun updateProfile(name: String, email: String, phone: String) {
        val uid = firebaseAuth.currentUser?.uid

        if (uid == null) {
            Log.e(TAG, "updateProfile: No user logged in")
            _uiState.update {
                it.copy(
                    isLoading = false,
                    errorMessage = "No user logged in. Please login again."
                )
            }
            return
        }

        val currentUser = _uiState.value.user
        if (currentUser == null) {
            Log.e(TAG, "updateProfile: No user data available")
            return
        }

        // Build update data map with only changed fields
        val updateData = mutableMapOf<String, String>()
        if (name != currentUser.name) {
            updateData["name"] = name
        }
        if (email != currentUser.email) {
            updateData["email"] = email
        }
        if (phone != currentUser.phone) {
            updateData["phone"] = phone
        }

        // If no changes, don't make API call
        if (updateData.isEmpty()) {
            Log.d(TAG, "updateProfile: No changes detected")
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            Log.d(TAG, "updateProfile: Updating profile for uid: $uid with data: $updateData")

            when (val result = profileRepository.updateProfile(uid, updateData)) {
                is BackendResult.Success -> {
                    Log.d(TAG, "updateProfile: Success - ${result.data.user.name}")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            user = result.data.user,
                            errorMessage = null
                        )
                    }
                }
                is BackendResult.Error -> {
                    Log.e(TAG, "updateProfile: Error - ${result.message}")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }
    fun logout() {
        Log.d(TAG, "logout: Clearing synced apps from database")
        viewModelScope.launch {
            try {
                // Clear all synced apps from Room database
                syncedAppRepository.deleteAllSyncedApps()
                Log.d(TAG, "logout: Database cleared successfully")

                // Sign out from Firebase
                firebaseAuth.signOut()
                Log.d(TAG, "logout: User signed out successfully")
            } catch (e: Exception) {
                Log.e(TAG, "logout: Error clearing database", e)
                // Still sign out even if database clear fails
                firebaseAuth.signOut()
                Log.d(TAG, "logout: User signed out successfully (despite database error)")
            }
        }
    }
}

