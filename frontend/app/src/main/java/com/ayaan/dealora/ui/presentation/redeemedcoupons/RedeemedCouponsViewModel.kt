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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
        private const val SEARCH_DEBOUNCE_MILLIS = 500L
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

    private var searchJob: Job? = null

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

                // Convert UI sort option to API value
                val sortByApi = when (_currentSortOption.value) {
                    SortOption.NEWEST_FIRST -> "newest_first"
                    SortOption.EXPIRING_SOON -> "expiring_soon"
                    SortOption.A_TO_Z -> "a_to_z"
                    SortOption.Z_TO_A -> "z_to_a"
                    else -> null
                }

                // Get category filter - convert "See All" to null
                val categoryApi = _currentCategory.value?.takeIf { it != "See All" }

                // Get filters from current filters
                val filters = _currentFilters.value
                val discountTypeApi = convertDiscountTypeToApi(filters.discountType)
                val priceApi = filters.getPriceApiValue()
                val validityApi = filters.getValidityApiValue()

                // Get search query (empty string converts to null)
                val searchApi = _searchQuery.value.takeIf { it.isNotBlank() }

                Log.d(TAG, "Filter params - search: $searchApi, sort: $sortByApi, category: $categoryApi")

                when (val result = couponRepository.syncPrivateCoupons(
                    brands = brands,
                    category = categoryApi,
                    search = searchApi,
                    discountType = discountTypeApi,
                    price = priceApi,
                    validity = validityApi,
                    sortBy = sortByApi,
                    page = null,
                    limit = null
                )) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "Private coupons loaded: ${result.coupons.size} coupons")
                        // Filter to show only redeemed ones (client-side)
                        val redeemedCoupons = result.coupons.filter { it.redeemed == true }
                        _allPrivateCoupons.value = redeemedCoupons
                        _filteredCoupons.value = redeemedCoupons
                        _uiState.value = RedeemedCouponsUiState.Success
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

    private fun convertDiscountTypeToApi(uiValue: String?): String? {
        return when (uiValue) {
            "Percentage Off (% Off)" -> "percentage_off"
            "Flat Discount (₹ Off)" -> "flat_discount"
            "Cashback" -> "cashback"
            "Buy 1 Get 1" -> "buy1get1"
            "Free Delivery" -> "free_delivery"
            "Wallet/UPI" -> "wallet_upi"
            "Prepaid Only" -> "prepaid_only"
            else -> null
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query

        // Cancel previous search job
        searchJob?.cancel()

        // Start new debounced search
        searchJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MILLIS)
            Log.d(TAG, "Search query debounced: $query")
            loadPrivateCoupons()
        }
    }

    fun onSortOptionChanged(sortOption: SortOption) {
        _currentSortOption.value = sortOption
        loadPrivateCoupons()
    }

    fun onCategoryChanged(category: String?) {
        _currentCategory.value = category
        loadPrivateCoupons()
    }

    fun onFiltersChanged(filters: com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions) {
        _currentFilters.value = filters
        loadPrivateCoupons()
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
