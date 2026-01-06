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
    private val firebaseAuth: FirebaseAuth
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
}

