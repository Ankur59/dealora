package com.ayaan.dealora.ui.presentation.redeemedcoupons

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for RedeemedCoupons screen showing only redeemed coupons
 */
@HiltViewModel
class RedeemedCouponsViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "RedeemedCouponsViewModel"
    }

    private val _uiState = MutableStateFlow<RedeemedCouponsUiState>(RedeemedCouponsUiState.Success)
    val uiState: StateFlow<RedeemedCouponsUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _allPrivateCoupons = MutableStateFlow<List<PrivateCoupon>>(emptyList())
    private val _filteredCoupons = MutableStateFlow<List<PrivateCoupon>>(emptyList())
    val filteredCoupons: StateFlow<List<PrivateCoupon>> = _filteredCoupons.asStateFlow()

    private val _currentSortOption = MutableStateFlow(SortOption.NONE)
    val currentSortOption: StateFlow<SortOption> = _currentSortOption.asStateFlow()

    private val _currentCategory = MutableStateFlow<String?>(null)
    val currentCategory: StateFlow<String?> = _currentCategory.asStateFlow()

    private val _currentFilters = MutableStateFlow(com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions())
    val currentFilters: StateFlow<com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions> = _currentFilters.asStateFlow()

    init {
        loadPrivateCoupons()
    }

    private fun loadPrivateCoupons() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Loading private coupons for redeemed screen")
                _uiState.value = RedeemedCouponsUiState.Loading

                // Fetch synced apps from database
                val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                Log.d(TAG, "Found ${syncedApps.size} synced apps in database")

                // Extract app names and capitalize first letter to match API format
                val brands = syncedApps.map { syncedApp ->
                    syncedApp.appName.replaceFirstChar { it.uppercase() }
                }

                Log.d(TAG, "Syncing brands: ${brands.joinToString()}")

                if (brands.isEmpty()) {
                    Log.d(TAG, "No synced apps found")
                    _uiState.value = RedeemedCouponsUiState.Success
                    _allPrivateCoupons.value = emptyList()
                    _filteredCoupons.value = emptyList()
                    return@launch
                }

                when (val result = couponRepository.syncPrivateCoupons(brands)) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "Private coupons loaded: ${result.coupons.size} coupons")
                        _allPrivateCoupons.value = result.coupons
                        _uiState.value = RedeemedCouponsUiState.Success
                        // Filter to show only redeemed ones
                        filterCoupons()
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "Error loading private coupons: ${result.message}")
                        _uiState.value = RedeemedCouponsUiState.Error(result.message)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading private coupons", e)
                _uiState.value = RedeemedCouponsUiState.Error("Unable to load coupons")
            }
        }
    }

    private fun filterCoupons() {
        val allCoupons = _allPrivateCoupons.value
        val query = _searchQuery.value.lowercase()
        val sortOption = _currentSortOption.value
        val categoryFilter = _currentCategory.value
        val filters = _currentFilters.value

        var filtered = allCoupons.filter { coupon ->
            // Must be redeemed
            coupon.redeemed == true && 
            // Search query match
            (query.isEmpty() || (
                coupon.brandName.lowercase().contains(query) ||
                coupon.couponTitle.lowercase().contains(query) ||
                (coupon.description?.lowercase()?.contains(query) ?: false)
            )) &&
            // Category filter
            (categoryFilter == null || categoryFilter == "See All" || coupon.category == categoryFilter) &&
            // Brand filter
            (filters.brand == null || coupon.brandName.equals(filters.brand, ignoreCase = true))
        }

        // Apply sort
        filtered = when (sortOption) {
            SortOption.NEWEST_FIRST -> filtered.sortedByDescending { it.createdAt }
            SortOption.OLDEST_FIRST -> filtered.sortedBy { it.createdAt }
            SortOption.EXPIRING_SOON -> filtered.sortedBy { it.daysUntilExpiry ?: Int.MAX_VALUE }
            SortOption.HIGHEST_DISCOUNT -> filtered // Private coupons don't have discount value, keep as-is
            SortOption.A_TO_Z -> filtered.sortedBy { it.brandName }
            SortOption.Z_TO_A -> filtered.sortedByDescending { it.brandName }
            SortOption.NONE -> filtered
        }

        _filteredCoupons.value = filtered
        Log.d(TAG, "Filtered redeemed coupons: ${filtered.size} out of ${allCoupons.size}, sort: $sortOption, category: $categoryFilter")
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        filterCoupons()
    }

    fun onSortOptionChanged(sortOption: SortOption) {
        _currentSortOption.value = sortOption
        filterCoupons()
    }

    fun onCategoryChanged(category: String?) {
        _currentCategory.value = category
        filterCoupons()
    }

    fun onFiltersChanged(filters: com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions) {
        _currentFilters.value = filters
        filterCoupons()
    }

    fun retry() {
        loadPrivateCoupons()
    }
}

/**
 * UI State for RedeemedCoupons screen
 */
sealed class RedeemedCouponsUiState {
    data object Loading : RedeemedCouponsUiState()
    data object Success : RedeemedCouponsUiState()
    data class Error(val message: String) : RedeemedCouponsUiState()
}
