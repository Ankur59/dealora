package com.ayaan.dealora.ui.presentation.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.BackendResult
import com.ayaan.dealora.data.auth.AuthRepository
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.ProfileRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
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
                    // Fetch statistics and explore coupons after profile is successful
                    fetchStatistics()
                    fetchExploreCoupons()
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
            val brands = if (syncedApps.isEmpty()) listOf("") else syncedApps.map { it.appName.replaceFirstChar { char -> char.uppercase() } }
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

    fun fetchExploreCoupons() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "fetchExploreCoupons: Fetching explore coupons with filters")
                _uiState.update { it.copy(isLoadingCoupons = true) }

                // Fetch synced apps from database
                val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                Log.d(TAG, "Found ${syncedApps.size} synced apps in database")

                // Extract app names and capitalize first letter to match API format
                val allSyncedBrands = syncedApps.map { syncedApp ->
                    syncedApp.appName.replaceFirstChar { it.uppercase() }
                }

                Log.d(TAG, "All synced brands: ${allSyncedBrands.joinToString()}")

                // If no synced apps, don't make API call
                if (allSyncedBrands.isEmpty()) {
                    Log.d(TAG, "No synced apps found, skipping explore coupons fetch")
                    _uiState.update { 
                        it.copy(
                            exploreCoupons = emptyList(),
                            isLoadingCoupons = false
                        )
                    }
                    return@launch
                }

                // Call sync endpoint with specified filters
                when (val result = couponRepository.syncPrivateCoupons(
                    brands = allSyncedBrands,
                    category = null,
                    search = null,
                    discountType = null,
                    price = "above_1500",
                    validity = "valid_this_week",
                    sortBy = null,
                    page = null,
                    limit = 5 // Limit to 5 coupons for home screen
                )) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "Explore coupons loaded: ${result.coupons.size} coupons")
                        _uiState.update { 
                            it.copy(
                                exploreCoupons = result.coupons,
                                isLoadingCoupons = false
                            )
                        }
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "Error loading explore coupons: ${result.message}")
                        _uiState.update { 
                            it.copy(
                                exploreCoupons = emptyList(),
                                isLoadingCoupons = false
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading explore coupons", e)
                _uiState.update { 
                    it.copy(
                        exploreCoupons = emptyList(),
                        isLoadingCoupons = false
                    )
                }
            }
        }
    }

    fun retry() {
        fetchProfile()
        fetchStatistics()
        fetchExploreCoupons()
    }

    fun logout() {
        Log.d(TAG, "logout: Initiating logout")
        authRepository.logout()
    }
}

