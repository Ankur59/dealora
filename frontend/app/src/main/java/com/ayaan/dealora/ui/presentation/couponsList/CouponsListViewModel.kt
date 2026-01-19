package com.ayaan.dealora.ui.presentation.couponsList

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.google.firebase.auth.FirebaseAuth
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
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "CouponsListViewModel"
        private const val SEARCH_DEBOUNCE_MS = 500L
    }

    private val _uiState = MutableStateFlow<CouponsListUiState>(CouponsListUiState.Success)
    val uiState: StateFlow<CouponsListUiState> = _uiState.asStateFlow()

    private val _couponsFlow = MutableStateFlow<PagingData<CouponListItem>>(PagingData.empty())
    val couponsFlow: StateFlow<PagingData<CouponListItem>> = _couponsFlow.asStateFlow()

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

    private var searchJob: Job? = null

    init {
        // Setup debounced search
        viewModelScope.launch {
            _searchQuery
                .debounce(SEARCH_DEBOUNCE_MS)
                .distinctUntilChanged()
                .collectLatest { query ->
                    Log.d(TAG, "Debounced search triggered with query: $query")
                    val filters = _currentFilters.value
                    loadCouponsInternal(
                        search = query.ifBlank { null },
                        sortBy = _currentSortOption.value.apiValue,
                        category = _currentCategory.value,
                        brand = filters.brand,
                        discountType = filters.getDiscountTypeApiValue(),
                        price = filters.getPriceApiValue(),
                        validity = filters.getValidityApiValue()
                    )
                }
        }

        // Load private coupons
        loadPrivateCoupons()
    }

//    init {
//        loadCoupons()
//    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun onSortOptionChanged(sortOption: SortOption) {
        _currentSortOption.value = sortOption
        val filters = _currentFilters.value
        loadCouponsInternal(
            search = _searchQuery.value.ifBlank { null },
            sortBy = sortOption.apiValue,
            category = _currentCategory.value,
            brand = filters.brand,
            discountType = filters.getDiscountTypeApiValue(),
            price = filters.getPriceApiValue(),
            validity = filters.getValidityApiValue()
        )
    }

    fun onCategoryChanged(category: String?) {
        // "See All" or null means no category filter
        val apiCategory = if (category == "See All") null else category
        _currentCategory.value = apiCategory
        val filters = _currentFilters.value
        loadCouponsInternal(
            search = _searchQuery.value.ifBlank { null },
            sortBy = _currentSortOption.value.apiValue,
            category = apiCategory,
            brand = filters.brand,
            discountType = filters.getDiscountTypeApiValue(),
            price = filters.getPriceApiValue(),
            validity = filters.getValidityApiValue()
        )
    }

    fun onFiltersChanged(filters: com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions) {
        _currentFilters.value = filters
        loadCouponsInternal(
            search = _searchQuery.value.ifBlank { null },
            sortBy = _currentSortOption.value.apiValue,
            category = _currentCategory.value,
            brand = filters.brand,
            discountType = filters.getDiscountTypeApiValue(),
            price = filters.getPriceApiValue(),
            validity = filters.getValidityApiValue()
        )
    }

    fun onPublicModeChanged(isPublic: Boolean) {
        _isPublicMode.value = isPublic
        if (isPublic) {
            // Load coupons from API when switching to public mode
            loadCoupons()
        } else {
            // Clear API data when switching to private mode
            _couponsFlow.value = PagingData.empty()
            _uiState.value = CouponsListUiState.Success
        }
    }

    fun loadCoupons(
        status: String = "active",
        brand: String? = null,
        discountType: String? = null
    ) {
        val filters = _currentFilters.value
        loadCouponsInternal(
            status = status,
            brand = brand,
            category = _currentCategory.value,
            discountType = discountType,
            search = _searchQuery.value.ifBlank { null },
            sortBy = _currentSortOption.value.apiValue,
            price = filters.getPriceApiValue(),
            validity = filters.getValidityApiValue()
        )
    }

    private fun loadCouponsInternal(
        status: String = "active",
        brand: String? = null,
        category: String? = null,
        discountType: String? = null,
        price: String? = null,
        validity: String? = null,
        search: String? = null,
        sortBy: String? = null
    ) {
        // Only load from API if in public mode
        if (!_isPublicMode.value) {
            Log.d(TAG, "Skipping API call - in private mode")
            _uiState.value = CouponsListUiState.Success
            return
        }

        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            _uiState.value = CouponsListUiState.Loading

            try {
                val currentUser = firebaseAuth.currentUser
                if (currentUser == null) {
                    Log.e(TAG, "User not authenticated")
                    _uiState.value = CouponsListUiState.Error("Please login to view your coupons.")
                    return@launch
                }

                val uid = currentUser.uid
                Log.d(TAG, "Loading coupons for uid: $uid, search: $search, sortBy: $sortBy")
                _uiState.value = CouponsListUiState.Success

                // Collect paging data
                couponRepository.getCoupons(
                    uid = uid,
                    status = status,
                    brand = brand,
                    category = category,
                    discountType = discountType,
                    price = price,
                    validity = validity,
                    search = search,
                    sortBy = sortBy
                ).cachedIn(viewModelScope).collectLatest { pagingData ->
                    _couponsFlow.value = pagingData
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading coupons", e)
                _uiState.value = CouponsListUiState.Error("Unable to load coupons. Please try again.")
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
                Log.d(TAG, "Loading private coupons")

                // Fetch synced apps from database
                val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                Log.d(TAG, "Found ${syncedApps.size} synced apps in database")

                // Extract app names and capitalize first letter to match API format
                val brands = syncedApps.map { syncedApp ->
                    syncedApp.appName.replaceFirstChar { it.uppercase() }
                }

                Log.d(TAG, "Syncing brands: ${brands.joinToString()}")

                // If no synced apps, don't make API call
                if (brands.isEmpty()) {
                    Log.d(TAG, "No synced apps found, skipping private coupons sync")
                    _privateCoupons.value = emptyList()
                    return@launch
                }

                when (val result = couponRepository.syncPrivateCoupons(brands)) {
                    is PrivateCouponResult.Success -> {
                        Log.d(TAG, "Private coupons loaded: ${result.coupons.size} coupons")
                        _privateCoupons.value = result.coupons
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
            }
        }
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

