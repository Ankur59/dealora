package com.ayaan.dealora.ui.presentation.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.BackendResult
import com.ayaan.dealora.data.auth.AuthRepository
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.ProfileRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

import com.ayaan.dealora.data.repository.SyncedAppRepository
import kotlinx.coroutines.flow.first

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val profileRepository: ProfileRepository,
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "HomeViewModel"
    }

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

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
                            user = result.data.user,
                            errorMessage = null
                        )
                    }
                    // Fetch statistics after profile is successful
                    fetchStatistics()
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

    fun fetchStatistics() {
        viewModelScope.launch {
            Log.d(TAG, "fetchStatistics: Fetching private coupon statistics")
            
            // Fetch synced brands from Room DB
            val syncedApps = syncedAppRepository.getAllSyncedApps().first()
            val brands = syncedApps.map { it.appName.replaceFirstChar { char -> char.uppercase() } }
            
            Log.d(TAG, "fetchStatistics: Synced brands: $brands")

            when (val result = couponRepository.getPrivateCouponStatistics(brands)) {
                is com.ayaan.dealora.data.repository.PrivateCouponStatisticsResult.Success -> {
                    Log.d(TAG, "fetchStatistics: Success - ${result.statistics.activeCouponsCount} coupons")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            statistics = result.statistics,
                            errorMessage = null
                        )
                    }
                }
                is com.ayaan.dealora.data.repository.PrivateCouponStatisticsResult.Error -> {
                    Log.e(TAG, "fetchStatistics: Error - ${result.message}")
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
        fetchStatistics()
    }

    fun logout() {
        Log.d(TAG, "logout: Initiating logout")
        authRepository.logout()
    }
}

