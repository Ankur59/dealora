package com.ayaan.dealora.ui.presentation.couponsList

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.ExclusiveCoupon
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.RawScrapedCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.ExclusiveCouponResult
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.RawCouponResult
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
        private const val RAW_PAGE_SIZE = 20
    }

    private val _uiState = MutableStateFlow<CouponsListUiState>(CouponsListUiState.Success)
    val uiState: StateFlow<CouponsListUiState> = _uiState.asStateFlow()

    // Raw scraped coupons (exclusive mode)
    private val _rawCoupons = MutableStateFlow<List<RawScrapedCoupon>>(emptyList())
    val rawCoupons: StateFlow<List<RawScrapedCoupon>> = _rawCoupons.asStateFlow()

    private val _isLoadingRawCoupons = MutableStateFlow(false)
    val isLoadingRawCoupons: StateFlow<Boolean> = _isLoadingRawCoupons.asStateFlow()

    private val _rawCouponsTotal = MutableStateFlow(0)
    private val _rawCouponsPage = MutableStateFlow(1)
    private val _rawCouponsPages = MutableStateFlow(1)

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

    init {
        // Setup debounced search for both modes
        viewModelScope.launch {
            _searchQuery
                .debounce(SEARCH_DEBOUNCE_MS)
                .distinctUntilChanged()
                .collectLatest { query ->
                    Log.d(TAG, "Debounced search triggered with query: $query")
                    if (_isPublicMode.value) {
                        loadRawCoupons(resetPage = true)
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
            loadRawCoupons(resetPage = true)
        } else {
            loadPrivateCoupons()
        }
    }

    fun onCategoryChanged(category: String?) {
        val apiCategory = if (category == "See All") null else category
        _currentCategory.value = apiCategory

        if (_isPublicMode.value) {
            loadRawCoupons(resetPage = true)
        } else {
            loadPrivateCoupons()
        }
    }

    fun onFiltersChanged(filters: com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions) {
        _currentFilters.value = filters

        if (_isPublicMode.value) {
            loadRawCoupons(resetPage = true)
        } else {
            loadPrivateCoupons()
        }
    }

    fun onPublicModeChanged(isPublic: Boolean) {
        _isPublicMode.value = isPublic
        if (isPublic) {
            loadRawCoupons(resetPage = true)
        } else {
            _rawCoupons.value = emptyList()
            _uiState.value = CouponsListUiState.Success
            loadPrivateCoupons()
        }
    }

    fun loadCoupons() {
        if (_isPublicMode.value) {
            loadRawCoupons(resetPage = true)
        } else {
            loadPrivateCoupons()
        }
    }

    fun loadNextRawPage() {
        if (_isLoadingRawCoupons.value) return
        if (_rawCouponsPage.value >= _rawCouponsPages.value) return
        loadRawCoupons(resetPage = false)
    }

    private fun loadRawCoupons(resetPage: Boolean = true) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            try {
                Log.d(TAG, "Loading raw coupons (exclusive mode) - resetPage=$resetPage")
                _isLoadingRawCoupons.value = true
                if (resetPage) _uiState.value = CouponsListUiState.Loading

                val currentPage = if (resetPage) 1 else (_rawCouponsPage.value + 1)

                val sortByApi = when (_currentSortOption.value) {
                    SortOption.NEWEST_FIRST -> "newest_first"
                    SortOption.EXPIRING_SOON -> "expiring_soon"
                    SortOption.A_TO_Z -> "a_z"
                    SortOption.Z_TO_A -> "z_a"
                    SortOption.HIGHEST_DISCOUNT -> "discountScore"
                    else -> "discountScore"
                }

                val categoryApi = _currentCategory.value?.takeIf { it != "See All" }
                val filters = _currentFilters.value
                val searchApi = _searchQuery.value.takeIf { it.isNotBlank() }
                val discountType = convertDiscountTypeToApi(filters.discountType)
                val validity = filters.getValidityApiValue()

                when (val result = couponRepository.getRawCoupons(
                    category = categoryApi,
                    brand = filters.brand,
                    search = searchApi,
                    discountType = discountType,
                    validity = validity,
                    sortBy = sortByApi,
                    page = currentPage,
                    limit = RAW_PAGE_SIZE
                )) {
                    is RawCouponResult.Success -> {
                        Log.d(TAG, "Raw coupons loaded: ${result.coupons.size} coupons (Total: ${result.total})")
                        val updatedList = if (resetPage) result.coupons else _rawCoupons.value + result.coupons
                        _rawCoupons.value = updatedList
                        _rawCouponsTotal.value = result.total
                        _rawCouponsPage.value = result.page
                        _rawCouponsPages.value = result.pages
                        _uiState.value = CouponsListUiState.Success
                    }
                    is RawCouponResult.Error -> {
                        Log.e(TAG, "Error loading raw coupons: ${result.message}")
                        if (resetPage) {
                            _rawCoupons.value = emptyList()
                            _uiState.value = CouponsListUiState.Error(result.message)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading raw coupons", e)
                if (resetPage) {
                    _rawCoupons.value = emptyList()
                    _uiState.value = CouponsListUiState.Error("Unable to load coupons. Please try again.")
                }
            } finally {
                _isLoadingRawCoupons.value = false
            }
        }
    }

    fun retry() {
        loadCoupons()
    }

    fun redeemCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val currentUser = firebaseAuth.currentUser
                if (currentUser == null) {
                    onError("Please login to redeem coupon")
                    return@launch
                }

                val uid = currentUser.uid
                when (val result = couponRepository.redeemPrivateCoupon(couponId, uid)) {
                    is PrivateCouponResult.Success -> {
                        onSuccess()
                        loadPrivateCoupons()
                    }
                    is PrivateCouponResult.Error -> onError(result.message)
                }
            } catch (e: Exception) {
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    fun redeemRawCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                // Local state update for raw coupons
                _rawCoupons.value = _rawCoupons.value.filter { it.id != couponId }
                onSuccess()
            } catch (e: Exception) {
                onError("Unable to mark coupon as redeemed.")
            }
        }
    }

    private fun loadPrivateCoupons() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Loading private coupons with filters")
                _isLoadingPrivateCoupons.value = true

                val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                val allSyncedBrands = syncedApps.map { it.appName.replaceFirstChar { it.uppercase() } }
                _syncedBrands.value = allSyncedBrands

                val filters = _currentFilters.value
                val brandsToSync = if (filters.brand != null && filters.brand in allSyncedBrands) {
                    listOf(filters.brand)
                } else {
                    allSyncedBrands
                }

                val sortByApi = when (_currentSortOption.value) {
                    SortOption.NEWEST_FIRST -> "newest_first"
                    SortOption.EXPIRING_SOON -> "expiring_soon"
                    SortOption.A_TO_Z -> "a_to_z"
                    SortOption.Z_TO_A -> "z_to_a"
                    else -> null
                }

                val categoryApi = _currentCategory.value?.takeIf { it != "See All" }
                val discountTypeApi = convertDiscountTypeToApi(filters.discountType)
                val priceApi = filters.getPriceApiValue()
                val validityApi = filters.getValidityApiValue()
                val searchApi = _searchQuery.value.takeIf { it.isNotBlank() }

                when (val result = couponRepository.syncPrivateCoupons(
                    brands = brandsToSync,
                    category = categoryApi,
                    search = searchApi,
                    discountType = discountTypeApi,
                    price = priceApi,
                    validity = validityApi,
                    sortBy = sortByApi,
                    status = "active"
                )) {
                    is PrivateCouponResult.Success -> {
                        val filteredCoupons = result.coupons.filter { coupon ->
                            val isNotRedeemed = coupon.status == "active"
                            val isNotExpired = (coupon.daysUntilExpiry ?: 0) >= 0
                            isNotRedeemed && isNotExpired
                        }
                        _privateCoupons.value = filteredCoupons
                    }
                    is PrivateCouponResult.Error -> _privateCoupons.value = emptyList()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading private coupons", e)
                _privateCoupons.value = emptyList()
            } finally {
                _isLoadingPrivateCoupons.value = false
            }
        }
    }

    private fun convertDiscountTypeToApi(uiValue: String?): String? = when (uiValue) {
        "Percentage Off (% Off)" -> "percentage_off"
        "Flat Discount" -> "flat_discount"
        "Cashback" -> "cashback"
        "Buy 1 Get 1" -> "buy1get1"
        "Free Delivery" -> "free_delivery"
        "Wallet/UPI Offers" -> "wallet_upi"
        "Prepaid Only Offers" -> "prepaid_only"
        else -> null
    }

    fun saveCoupon(couponId: String, couponJson: String, isPrivate: Boolean = true) {
        viewModelScope.launch {
            try {
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = if (isPrivate) "private" else "public"
                )
                _savedCouponIds.value = _savedCouponIds.value + couponId
            } catch (e: Exception) {
                Log.e(TAG, "Error saving coupon: $couponId", e)
            }
        }
    }

    fun saveRawCoupon(coupon: RawScrapedCoupon) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(RawScrapedCoupon::class.java)
                val couponJson = adapter.toJson(coupon)
                savedCouponRepository.saveCoupon(
                    couponId = coupon.id,
                    couponJson = couponJson,
                    couponType = "raw"
                )
                _savedCouponIds.value = _savedCouponIds.value + coupon.id
            } catch (e: Exception) {
                Log.e(TAG, "Error saving raw coupon: ${coupon.id}", e)
            }
        }
    }

    fun removeSavedCoupon(couponId: String) {
        viewModelScope.launch {
            try {
                savedCouponRepository.removeSavedCoupon(couponId)
                _savedCouponIds.value = _savedCouponIds.value - couponId
            } catch (e: Exception) {
                Log.e(TAG, "Error removing coupon: $couponId", e)
            }
        }
    }

    fun saveCouponFromModel(couponId: String, privateCoupon: PrivateCoupon) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(PrivateCoupon::class.java)
                val couponJson = adapter.toJson(privateCoupon)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = "private"
                )
                _savedCouponIds.value = _savedCouponIds.value + couponId
            } catch (e: Exception) {
                Log.e(TAG, "Error saving private coupon: $couponId", e)
            }
        }
    }

    fun saveCouponFromExclusiveCoupon(couponId: String, exclusiveCoupon: ExclusiveCoupon) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(ExclusiveCoupon::class.java)
                val couponJson = adapter.toJson(exclusiveCoupon)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = couponJson,
                    couponType = "public"
                )
                _savedCouponIds.value = _savedCouponIds.value + couponId
            } catch (e: Exception) {
                Log.e(TAG, "Error saving exclusive coupon: $couponId", e)
            }
        }
    }

    fun getRawCouponsPage() = _rawCouponsPage.value
    fun getRawCouponsPages() = _rawCouponsPages.value
}

/**
 * UI State for CouponsList screen
 */
sealed class CouponsListUiState {
    data object Loading : CouponsListUiState()
    data object Success : CouponsListUiState()
    data class Error(val message: String) : CouponsListUiState()
}
