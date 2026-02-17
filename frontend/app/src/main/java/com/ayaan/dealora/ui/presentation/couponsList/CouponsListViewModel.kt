package com.ayaan.dealora.ui.presentation.couponsList

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.ExclusiveCoupon
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.ExclusiveCouponResult
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SavedCouponRepository
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.google.firebase.auth.FirebaseAuth
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for CouponsList screen
 */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
@HiltViewModel
class CouponsListViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val firebaseAuth: FirebaseAuth,
    val moshi: Moshi
) : ViewModel() {


    companion object {
        private const val TAG = "CouponsListViewModel"
        private const val SEARCH_DEBOUNCE_MS = 500L
        private const val SEARCH_DEBOUNCE_PRIVATE_MS = 500L
    }

    private val _uiState = MutableStateFlow<CouponsListUiState>(CouponsListUiState.Success)
    val uiState: StateFlow<CouponsListUiState> = _uiState.asStateFlow()

    // Exclusive coupons (public mode)
    private val _exclusiveCoupons = MutableStateFlow<List<ExclusiveCoupon>>(emptyList())
    val exclusiveCoupons: StateFlow<List<ExclusiveCoupon>> = _exclusiveCoupons.asStateFlow()

    private val _isLoadingExclusiveCoupons = MutableStateFlow(false)
    val isLoadingExclusiveCoupons: StateFlow<Boolean> = _isLoadingExclusiveCoupons.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _currentSortOption = MutableStateFlow(SortOption.NONE)
    val currentSortOption: StateFlow<SortOption> = _currentSortOption.asStateFlow()

    private val _currentCategory = MutableStateFlow<String?>(null)
    val currentCategory: StateFlow<String?> = _currentCategory.asStateFlow()

    private val _currentFilters = MutableStateFlow(com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions())
    val currentFilters: StateFlow<com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions> = _currentFilters.asStateFlow()

    private val _isPublicMode = MutableStateFlow(false)
    val isPublicMode: StateFlow<Boolean> = _isPublicMode.asStateFlow()

    private val _privateCoupons = MutableStateFlow<List<PrivateCoupon>>(emptyList())
    val privateCoupons: StateFlow<List<PrivateCoupon>> = _privateCoupons.asStateFlow()

    private val _isLoadingPrivateCoupons = MutableStateFlow(false)
    val isLoadingPrivateCoupons: StateFlow<Boolean> = _isLoadingPrivateCoupons.asStateFlow()

    private val _savedCouponIds = MutableStateFlow<Set<String>>(emptySet())
    val savedCouponIds: StateFlow<Set<String>> = _savedCouponIds.asStateFlow()

    private val _syncedBrands = MutableStateFlow<List<String>>(emptyList())
    val syncedBrands: StateFlow<List<String>> = _syncedBrands.asStateFlow()

    private var searchJob: Job? = null
    private var privateSearchJob: Job? = null

    init {
        // Setup debounced search for both modes
        viewModelScope.launch {
            _searchQuery
                .debounce(SEARCH_DEBOUNCE_MS)
                .distinctUntilChanged()
                .collectLatest { query ->
                    Log.d(TAG, "Debounced search triggered with query: $query")
                    if (_isPublicMode.value) {
                        loadExclusiveCoupons()
                    } else {
                        loadPrivateCoupons()
                    }
                }
        }

        // Load private coupons by default
        loadPrivateCoupons()
    }

    init {
        // Load saved coupon IDs
        viewModelScope.launch {
            savedCouponRepository.getAllSavedCoupons().collectLatest { savedCoupons ->
                _savedCouponIds.value = savedCoupons.map { it.couponId }.toSet()
                Log.d(TAG, "Updated saved coupon IDs: ${_savedCouponIds.value}")
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        // Search is handled by the debounced flow in init for both modes
    }

    fun onSortOptionChanged(sortOption: SortOption) {
        _currentSortOption.value = sortOption

        if (_isPublicMode.value) {
            // Reload exclusive coupons with new sort
            loadExclusiveCoupons()
        } else {
            // Reload private coupons with new sort
            loadPrivateCoupons()
        }
    }

    fun onCategoryChanged(category: String?) {
        // "See All" or null means no category filter
        val apiCategory = if (category == "See All") null else category
        _currentCategory.value = apiCategory

        if (_isPublicMode.value) {
            // Reload exclusive coupons with new category
            loadExclusiveCoupons()
        } else {
            // Reload private coupons with new category
            loadPrivateCoupons()
        }
    }

    fun onFiltersChanged(filters: com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions) {
        _currentFilters.value = filters

        if (_isPublicMode.value) {
            // Reload exclusive coupons with new filters
            loadExclusiveCoupons()
        } else {
            // Reload private coupons with new filters
            loadPrivateCoupons()
        }
    }

    fun onPublicModeChanged(isPublic: Boolean) {
        _isPublicMode.value = isPublic
        if (isPublic) {
            // Load exclusive coupons when switching to public mode
            loadExclusiveCoupons()
        } else {
            // Clear exclusive coupons when switching to private mode
            _exclusiveCoupons.value = emptyList()
            _uiState.value = CouponsListUiState.Success
            // Load private coupons
            loadPrivateCoupons()
        }
    }

    fun loadCoupons() {
        if (_isPublicMode.value) {
            loadExclusiveCoupons()
        } else {
            loadPrivateCoupons()
        }
    }

    private fun loadExclusiveCoupons() {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            try {
                Log.d(TAG, "Loading exclusive coupons with filters")
                _isLoadingExclusiveCoupons.value = true
                _uiState.value = CouponsListUiState.Loading

                // Convert UI sort option to API value
                val sortByApi = when (_currentSortOption.value) {
                    SortOption.NEWEST_FIRST -> "newest_first"
                    SortOption.EXPIRING_SOON -> "expiring_soon"
                    SortOption.A_TO_Z -> "a_to_z"
                    SortOption.Z_TO_A -> "z_to_a"
                    else -> null
                }

                // Get category filter
                val categoryApi = _currentCategory.value?.takeIf { it != "See All" }

                // Get filters
                val filters = _currentFilters.value
                val brandApi = filters.brand

                // Get search query
                val searchApi = _searchQuery.value.takeIf { it.isNotBlank() }

                // Get validity filter
                val validityApi = filters.getValidityApiValue()

                // Get stackable filter (convert from filters if available)
                val stackableApi = null // Add this to FilterOptions if needed

                Log.d(TAG, "Filter params - search: $searchApi, sort: $sortByApi, category: $categoryApi, brand: $brandApi, validity: $validityApi")

                when (val result = couponRepository.getExclusiveCoupons(
                    brands = null, // Send null to get all brands
                    brand = brandApi,
                    category = categoryApi,
                    search = searchApi,
                    source = null,
                    stackable = stackableApi,
                    validity = validityApi,
                    sortBy = sortByApi,
                    limit = null, // Get all results
                    page = null
                )) {
                    is ExclusiveCouponResult.Success -> {
                        Log.d(TAG, "Exclusive coupons loaded: ${result.coupons.size} coupons")
                        _exclusiveCoupons.value = result.coupons
                        _uiState.value = CouponsListUiState.Success
                    }
                    is ExclusiveCouponResult.Error -> {
                        Log.e(TAG, "Error loading exclusive coupons: ${result.message}")
                        _exclusiveCoupons.value = emptyList()
                        _uiState.value = CouponsListUiState.Error(result.message)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading exclusive coupons", e)
                _exclusiveCoupons.value = emptyList()
                _uiState.value = CouponsListUiState.Error("Unable to load coupons. Please try again.")
            } finally {
                _isLoadingExclusiveCoupons.value = false
            }
        }
    }

    fun retry() {
        loadCoupons()
    }

    fun redeemCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        Log.d(TAG, "========== REDEEM COUPON (LIST) FLOW STARTED ==========")
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
                Log.d(TAG, "========== REDEEM COUPON (LIST) FLOW COMPLETED ==========")
            } catch (e: Exception) {
                Log.e(TAG, "✗ EXCEPTION in redeem flow: ${e.message}", e)
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    private fun loadPrivateCoupons() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Loading private coupons with filters")
                _isLoadingPrivateCoupons.value = true

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

                // If no synced apps, don't make API call
                if (allSyncedBrands.isEmpty()) {
                    Log.d(TAG, "No synced apps found, skipping private coupons sync")
                    _privateCoupons.value = emptyList()
                    _isLoadingPrivateCoupons.value = false
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

                Log.d(TAG, "Filter params - search: $searchApi, sort: $sortByApi, category: $categoryApi, discountType: $discountTypeApi, price: $priceApi, validity: $validityApi, brand: ${filters.brand}")

                when (val result = couponRepository.syncPrivateCoupons(
                    brands = brandsToSync,
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

                        // Filter out redeemed and expired coupons
                        val filteredCoupons = result.coupons.filter { coupon ->
                            val isNotRedeemed = coupon.redeemed != true
                            val isNotExpired = (coupon.daysUntilExpiry ?: 0) > 0
                            isNotRedeemed && isNotExpired
                        }

                        Log.d(TAG, "Filtered coupons (excluding redeemed/expired): ${filteredCoupons.size} coupons")
                        _privateCoupons.value = filteredCoupons
                    }
                    is PrivateCouponResult.Error -> {
                        Log.e(TAG, "Error loading private coupons: ${result.message}")
                        // Keep empty list on error
                        _privateCoupons.value = emptyList()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading private coupons", e)
                _privateCoupons.value = emptyList()
            } finally {
                _isLoadingPrivateCoupons.value = false
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

    fun saveCoupon(couponId: String, couponJson: String, isPrivate: Boolean = true) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Saving coupon: $couponId, isPrivate: $isPrivate")
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = if (isPrivate) "private" else "public"
                )
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value + couponId
                Log.d(TAG, "Coupon saved successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving coupon: $couponId", e)
            }
        }
    }

    fun saveCouponFromListItem(couponId: String, coupon: CouponListItem) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Saving coupon list item: $couponId")
                val adapter = moshi.adapter(CouponListItem::class.java)
                val couponJson = adapter.toJson(coupon)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = "public"
                )
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value + couponId
                Log.d(TAG, "Coupon list item saved successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving coupon list item: $couponId", e)
            }
        }
    }

    fun saveCouponFromModel(couponId: String, coupon: PrivateCoupon) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Saving coupon model: $couponId")
                val adapter = moshi.adapter(PrivateCoupon::class.java)
                val couponJson = adapter.toJson(coupon)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = "private"
                )
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value + couponId
                Log.d(TAG, "Coupon model saved successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving coupon model: $couponId", e)
            }
        }
    }

    fun saveCouponFromExclusiveCoupon(couponId: String, coupon: ExclusiveCoupon) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Saving exclusive coupon: $couponId")
                val adapter = moshi.adapter(ExclusiveCoupon::class.java)
                val couponJson = adapter.toJson(coupon)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = "exclusive"
                )
                // Update local state
                _savedCouponIds.value = _savedCouponIds.value + couponId
                Log.d(TAG, "Exclusive coupon saved successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving exclusive coupon: $couponId", e)
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
                Log.d(TAG, "Coupon removed successfully: $couponId")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing coupon: $couponId", e)
            }
        }
    }

    fun isCouponSaved(couponId: String): Boolean {
        return _savedCouponIds.value.contains(couponId)
    }

    fun cacheExclusiveCoupon(coupon: ExclusiveCoupon) {
        couponRepository.cacheExclusiveCoupon(coupon)
    }
}

/**
 * UI State for CouponsList screen
 */
sealed class CouponsListUiState {
    data object Loading : CouponsListUiState()
    data object Success : CouponsListUiState()
    data class Error(val message: String) : CouponsListUiState()
}

