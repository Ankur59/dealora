package com.ayaan.dealora.ui.presentation.dashboard

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.local.entity.SavedCouponEntity
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SavedCouponRepository
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.google.firebase.auth.FirebaseAuth
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for Dashboard screen showing only saved coupons
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val firebaseAuth: FirebaseAuth,
    val moshi: Moshi
) : ViewModel() {


    companion object {
        private const val TAG = "DashboardViewModel"
        private const val SEARCH_DEBOUNCE_MILLIS = 500L
    }

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Success)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _allPrivateCoupons = MutableStateFlow<List<PrivateCoupon>>(emptyList())
    private val _filteredCoupons = MutableStateFlow<List<PrivateCoupon>>(emptyList())
    val filteredCoupons: StateFlow<List<PrivateCoupon>> = _filteredCoupons.asStateFlow()

    private val _savedCouponIds = MutableStateFlow<Set<String>>(emptySet())
    val savedCouponIds: StateFlow<Set<String>> = _savedCouponIds.asStateFlow()

    private val _savedCoupons = MutableStateFlow<List<SavedCouponEntity>>(emptyList())

    private val _currentSortOption = MutableStateFlow(SortOption.NONE)
    val currentSortOption: StateFlow<SortOption> = _currentSortOption.asStateFlow()

    private val _currentCategory = MutableStateFlow<String?>(null)
    val currentCategory: StateFlow<String?> = _currentCategory.asStateFlow()

    private val _currentFilters = MutableStateFlow(com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions())
    val currentFilters: StateFlow<com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions> = _currentFilters.asStateFlow()

    private val _statusFilter = MutableStateFlow("active") // "active", "redeemed", "expired", "saved"
    val statusFilter: StateFlow<String> = _statusFilter.asStateFlow()

    private val _syncedBrands = MutableStateFlow<List<String>>(emptyList())
    val syncedBrands: StateFlow<List<String>> = _syncedBrands.asStateFlow()

    private var searchJob: Job? = null

    init {
        // Load all private coupons and saved IDs
        viewModelScope.launch {
            // Load saved coupon IDs
            // Load saved coupons and IDs
            savedCouponRepository.getAllSavedCoupons().collectLatest { savedCoupons ->
                _savedCoupons.value = savedCoupons
                _savedCouponIds.value = savedCoupons.map { it.couponId }.toSet()
                Log.d(TAG, "Updated saved coupons: ${savedCoupons.size}")
                // Filter coupons by status whenever saved IDs change
                filterCouponsByStatus()
            }
        }

        loadPrivateCoupons()
    }

    private fun loadPrivateCoupons() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Loading private coupons for dashboard")
                _uiState.value = DashboardUiState.Loading

                // Fetch synced apps from database
                val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                Log.d(TAG, "Found ${syncedApps.size} synced apps in database")

                // Extract app names and capitalize first letter to match API format
                val allSyncedBrands = syncedApps.map { syncedApp ->
                    syncedApp.appName.replaceFirstChar { it.uppercase() }
                }

                // Store synced brands in StateFlow for use in FiltersBottomSheet
                _syncedBrands.value = allSyncedBrands

                Log.d(TAG, "All synced brands: ${allSyncedBrands.joinToString()}")

                if (allSyncedBrands.isEmpty()) {
                    Log.d(TAG, "No synced apps found")
                    _uiState.value = DashboardUiState.Success
                    _allPrivateCoupons.value = emptyList()
                    _filteredCoupons.value = emptyList()
                    return@launch
                }

                // Determine which brands to send to API
                val filters = _currentFilters.value
                val brandsToSync = if (filters.brand != null && filters.brand in allSyncedBrands) {
                    // If a brand is selected in filters, send only that brand
                    listOf(filters.brand)
                } else {
                    // If no brand selected or invalid brand, send all synced brands
                    allSyncedBrands
                }

                Log.d(TAG, "Brands to sync (after filter): ${brandsToSync.joinToString()}")

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
                val discountTypeApi = convertDiscountTypeToApi(filters.discountType)
                val priceApi = filters.getPriceApiValue()
                val validityApi = filters.getValidityApiValue()

                // Get search query (empty string converts to null)
                val searchApi = _searchQuery.value.takeIf { it.isNotBlank() }

                Log.d(TAG, "Filter params - search: $searchApi, sort: $sortByApi, category: $categoryApi, brand: ${filters.brand}")

                when (val result = couponRepository.syncPrivateCoupons(
                    brands = brandsToSync,
                    category = categoryApi,
                    search = searchApi,
                    discountType = discountTypeApi,
                    price = priceApi,
                    validity = validityApi,
                    sortBy = sortByApi,
                    page = null, // Get all for now
                    limit = null
                )) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "Private coupons loaded: ${result.coupons.size} coupons")
                        _allPrivateCoupons.value = result.coupons
                        _uiState.value = DashboardUiState.Success
                        // Apply client-side status filter (active/redeemed/expired/saved)
                        filterCouponsByStatus()
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "Error loading private coupons: ${result.message}")
                        _uiState.value = DashboardUiState.Error(result.message)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading private coupons", e)
                _uiState.value = DashboardUiState.Error("Unable to load coupons")
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

    private fun filterCouponsByStatus() {
        val allCouponsFromApi = _allPrivateCoupons.value
        val savedIds = _savedCouponIds.value
        val savedEntities = _savedCoupons.value
        val statusFilterValue = _statusFilter.value

        Log.d(TAG, "=== FILTER DEBUG START ===")
        Log.d(TAG, "Total coupons from API: ${allCouponsFromApi.size}")
        Log.d(TAG, "Status filter: $statusFilterValue")
        Log.d(TAG, "Saved coupon entities: ${savedEntities.size}")

        val filtered = when (statusFilterValue) {
            "saved" -> {
                // Combine API coupons with those stored in DB
                val combined = mutableListOf<PrivateCoupon>()
                val addedIds = mutableSetOf<String>()

                // 1. Add API coupons if they are in saved IDs
                allCouponsFromApi.filter { savedIds.contains(it.id) }.forEach {
                    combined.add(it)
                    addedIds.add(it.id)
                }

                // 2. Add coupons from DB that weren't in the API response
                savedEntities.filter { !addedIds.contains(it.couponId) }.forEach { savedCoupon ->
                    val coupon = try {
                        if (savedCoupon.couponType == "private") {
                            moshi.adapter(PrivateCoupon::class.java).fromJson(savedCoupon.couponJson)
                        } else {
                            // Map public CouponListItem to PrivateCoupon
                            moshi.adapter(CouponListItem::class.java).fromJson(savedCoupon.couponJson)?.let { listItem ->
                                PrivateCoupon(
                                    id = listItem.id,
                                    brandName = listItem.brandName ?: "Dealora",
                                    couponTitle = listItem.couponTitle ?: "Special Offer",
                                    description = listItem.description,
                                    category = listItem.category,
                                    daysUntilExpiry = listItem.daysUntilExpiry,
                                    redeemable = false, // Public usually not redeemable in-app
                                    redeemed = false,
                                    couponType = "public"
                                )
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing saved coupon JSON: ${savedCoupon.couponId}", e)
                        null
                    }

                    coupon?.let {
                        combined.add(it)
                        addedIds.add(it.id)
                    }
                }
                combined
            }
            "redeemed" -> allCouponsFromApi.filter { it.redeemed == true }
            "expired" -> {
                allCouponsFromApi.filter { coupon ->
                    val isExpired = (coupon.daysUntilExpiry ?: 0) < 0
                    Log.d(TAG, "Checking expired for ${coupon.couponTitle}: daysUntilExpiry=${coupon.daysUntilExpiry}, isExpired=$isExpired")
                    isExpired
                }
            }
            "active" -> {
                // Active: neither expired nor redeemed
                allCouponsFromApi.filter { coupon ->
                    (coupon.daysUntilExpiry ?: 0) >= 0 && coupon.redeemed != true
                }
            }
            else -> allCouponsFromApi.filter { savedIds.contains(it.id) }
        }

        _filteredCoupons.value = filtered
        Log.d(TAG, "Filtered coupons: ${filtered.size}, status: $statusFilterValue")
        Log.d(TAG, "=== FILTER DEBUG END ===")
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

    fun onStatusFilterChanged(status: String) {
        _statusFilter.value = status
        // Status filter is client-side only, no need to reload from API
        filterCouponsByStatus()
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
                    couponType = "private" // Save as private since we have the full PrivateCoupon model now
                )
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value + coupon.id
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
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value - couponId
                // This will trigger filterCoupons through the collectLatest in init
                Log.d(TAG, "Coupon removed successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing coupon: $couponId", e)
            }
        }
    }

    fun redeemCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        Log.d(TAG, "========== REDEEM COUPON (DASHBOARD) FLOW STARTED ==========")
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
                        if (result.coupons.isNotEmpty()) {
                            val redeemedCoupon = result.coupons[0]
                            Log.d(TAG, "Redeemed coupon details:")
                            Log.d(TAG, "  - ID: ${redeemedCoupon.id}")
                            Log.d(TAG, "  - Brand: ${redeemedCoupon.brandName}")
                            Log.d(TAG, "  - Title: ${redeemedCoupon.couponTitle}")
                            Log.d(TAG, "  - Redeemable: ${redeemedCoupon.redeemable}")
                            Log.d(TAG, "  - Redeemed: ${redeemedCoupon.redeemed}")
                        }
                        onSuccess()
                        // Reload private coupons to show updated state
                        loadPrivateCoupons()
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "✗ ERROR: ${result.message}")
                        onError(result.message)
                    }
                }
                Log.d(TAG, "========== REDEEM COUPON (DASHBOARD) FLOW COMPLETED ==========")
            } catch (e: Exception) {
                Log.e(TAG, "✗ EXCEPTION in redeem flow: ${e.message}", e)
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    fun retry() {
        loadPrivateCoupons()
    }
}

/**
 * UI State for Dashboard screen
 */
sealed class DashboardUiState {
    data object Loading : DashboardUiState()
    data object Success : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}
