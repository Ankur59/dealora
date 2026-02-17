package com.ayaan.dealora.ui.presentation.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.BackendResult
import com.ayaan.dealora.data.auth.AuthRepository
import com.ayaan.dealora.data.repository.BackendAuthRepository
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.ProfileRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SavedCouponRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import com.squareup.moshi.Moshi
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.PrivateCouponStatisticsResult
import com.ayaan.dealora.data.repository.SyncedAppRepository
import kotlinx.coroutines.tasks.await

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val profileRepository: ProfileRepository,
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val backendAuthRepository: BackendAuthRepository,
    private val firebaseAuth: FirebaseAuth,
    val moshi: Moshi
) : ViewModel() {


    companion object {
        private const val TAG = "HomeViewModel"
    }

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _savedCouponIds = MutableStateFlow<Set<String>>(emptySet())
    val savedCouponIds: StateFlow<Set<String>> = _savedCouponIds.asStateFlow()

    init {
        observeSavedCoupons()
    }

    private fun observeSavedCoupons() {
        viewModelScope.launch {
            savedCouponRepository.getAllSavedCoupons().collectLatest { savedCoupons ->
                val ids = savedCoupons.map { it.couponId }.toSet()
                _savedCouponIds.value = ids
            }
        }
    }

    /**
     * Fetch FCM token and update it on the backend
     */
    fun updateFcmToken() {
        val uid = firebaseAuth.currentUser?.uid

        if (uid == null) {
            Log.e(TAG, "updateFcmToken: No user logged in")
            return
        }

        viewModelScope.launch {
            try {
                Log.d(TAG, "updateFcmToken: Fetching FCM token from Firebase")

                // Get FCM token from Firebase Messaging
                val token = FirebaseMessaging.getInstance().token.await()

                Log.d(TAG, "updateFcmToken: FCM Token retrieved: ${token.take(20)}...")

                // Send token to backend
                val success = backendAuthRepository.updateFcmToken(uid, token)

                if (success) {
                    Log.d(TAG, "updateFcmToken: FCM token updated successfully on backend")
                } else {
                    Log.e(TAG, "updateFcmToken: Failed to update FCM token on backend")
                }
            } catch (e: Exception) {
                Log.e(TAG, "updateFcmToken: Exception occurred", e)
            }
        }
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

            val syncedApps = syncedAppRepository.getAllSyncedApps().first()

            var brands = syncedApps.map { syncedApp ->
                syncedApp.appName.replaceFirstChar { it.uppercase() }
            }

            if (brands.isEmpty()) {
                brands = listOf("")
            }

            Log.d(TAG, "fetchStatistics: Using synced brands: ${brands.joinToString()}")

            when (val result = couponRepository.getPrivateCouponStatistics(brands)) {
                is PrivateCouponStatisticsResult.Success -> {
                    Log.d(TAG, "fetchStatistics: Success - ${result.statistics.activeCouponsCount} coupons")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            statistics = result.statistics,
                            errorMessage = null
                        )
                    }
                }

                is PrivateCouponStatisticsResult.Error -> {
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

                // Use hardcoded brands: Amazon, Blinkit, Cred, Nykaa
                val brands = listOf("Amazon", "Blinkit", "Cred", "Nykaa")
                Log.d(TAG, "Using hardcoded brands: ${brands.joinToString()}")

                // Call sync endpoint with specified filters
                when (val result = couponRepository.syncPrivateCoupons(
                    brands = brands,
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

    fun cacheExploringCoupon(coupon: PrivateCoupon) {
        try {
            Log.d(TAG, "Caching exploring coupon: ${coupon.id}")
            couponRepository.cacheCoupon(coupon)
        } catch (e: Exception) {
            Log.e(TAG, "Error caching coupon: ${coupon.id}", e)
        }
    }

    fun saveCoupon(coupon: PrivateCoupon) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Saving coupon: ${coupon.id}")
                val adapter = moshi.adapter(PrivateCoupon::class.java)
                val couponJson = adapter.toJson(coupon)
                savedCouponRepository.saveCoupon(
                    couponId = coupon.id,
                    couponJson = couponJson,
                    couponType = "private"
                )
                Log.d(TAG, "Coupon saved successfully: ${coupon.id}")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving coupon: ${coupon.id}", e)
            }
        }
    }

    fun removeSavedCoupon(couponId: String) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Removing saved coupon: $couponId")
                savedCouponRepository.removeSavedCoupon(couponId)
                Log.d(TAG, "Coupon removed successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing coupon: $couponId", e)
            }
        }
    }

    fun redeemCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        Log.d(TAG, "========== REDEEM COUPON (HOME) FLOW STARTED ==========")
        Log.d(TAG, "Coupon ID: $couponId")

        viewModelScope.launch {
            try {
                val currentUser = firebaseAuth.currentUser
                if (currentUser == null) {
                    Log.e(TAG, "User not authenticated")
                    onError("Please login to redeem coupon")
                    return@launch
                }

                val uid = currentUser.uid
                Log.d(TAG, "✓ User authenticated - UID: $uid")
                Log.d(TAG, "→ Calling repository.redeemPrivateCoupon(couponId=$couponId, uid=$uid)")

                when (val result = couponRepository.redeemPrivateCoupon(couponId, uid)) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "✓ SUCCESS: Coupon redeemed successfully")
                        Log.d(TAG, "Response message: ${result.message}")
                        onSuccess()
                        // Reload explore coupons to show updated state
                        fetchExploreCoupons()
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "✗ ERROR: ${result.message}")
                        onError(result.message)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "✗ EXCEPTION in redeem flow: ${e.message}", e)
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    fun logout() {
        Log.d(TAG, "logout: Initiating logout")
        authRepository.logout()
    }

    suspend fun areAllAppsSynced(): Boolean {
        // Total available apps that can be synced
        val totalAvailableApps = listOf("zomato", "phonepe", "blinkit", "amazon", "nykaa", "cred", "swiggy")

        val syncedApps = syncedAppRepository.getAllSyncedApps().first()
        val syncedAppIds = syncedApps.map { it.appId.lowercase() }.toSet()

        Log.d(TAG, "Total available apps: ${totalAvailableApps.size}")
        Log.d(TAG, "Synced apps: ${syncedAppIds.size}")
        Log.d(TAG, "Synced app IDs: ${syncedAppIds.joinToString()}")

        return syncedAppIds.containsAll(totalAvailableApps)
    }
}
