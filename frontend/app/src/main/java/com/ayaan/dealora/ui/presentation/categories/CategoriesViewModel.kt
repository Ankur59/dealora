package com.ayaan.dealora.ui.presentation.categories

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.PartnerCoupon
import com.ayaan.dealora.data.api.models.RawScrapedCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.RawCouponResult
import com.ayaan.dealora.data.repository.PartnerCouponResult
import com.ayaan.dealora.data.repository.PartnerCouponRedeemResult
import com.ayaan.dealora.data.repository.SavedCouponRepository
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.data.util.CategoryMapper
import com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CategoryGroup(
    val name: String,
    val totalCount: Int,
    val coupons: List<CouponListItem>
)

data class CategoriesUiState(
    val isLoading: Boolean = false,
    val categoryGroups: List<CategoryGroup> = emptyList(),
    val errorMessage: String? = null,
    val isPublicMode: Boolean = false,
    val savedCouponIds: Set<String> = emptySet(),

    // ── Exclusive (partner coupon) mode state ───────────────────────────
    val isExclusiveMode: Boolean = false,
    val rawCoupons: List<PartnerCoupon> = emptyList(),
    val rawCouponsTotal: Int = 0,
    val rawCouponsPage: Int = 1,
    val rawCouponsPages: Int = 1,
    val isLoadingRawCoupons: Boolean = false
)

@HiltViewModel
class CategoriesViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val firebaseAuth: FirebaseAuth,
    val moshi: Moshi
) : ViewModel() {

    companion object {
        private const val TAG = "CategoriesViewModel"
        private const val SEARCH_DEBOUNCE_MS = 500L
        private const val RAW_PAGE_SIZE = 20
    }

    private val _uiState = MutableStateFlow(CategoriesUiState())
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // Sort/filter for exclusive mode (mirrors dashboard pattern)
    private val _currentSortOption = MutableStateFlow(SortOption.NONE)
    val currentSortOption: StateFlow<SortOption> = _currentSortOption.asStateFlow()

    private val _currentCategory = MutableStateFlow<String?>(null)
    val currentCategory: StateFlow<String?> = _currentCategory.asStateFlow()

    private val _currentFilters = MutableStateFlow(FilterOptions())
    val currentFilters: StateFlow<FilterOptions> = _currentFilters.asStateFlow()

    private val categories = listOf(
        "Food", "Fashion", "Grocery", "Wallet Rewards", "Beauty", "Travel", "Entertainment"
    )

    // Private mode coupon cache
    private val privateCouponsMap = mutableMapOf<String, PrivateCoupon>()

    private var searchJob: Job? = null
    private var rawLoadJob: Job? = null

    init {
        fetchAllCategories()
        observeSavedCoupons()
    }

    private fun observeSavedCoupons() {
        viewModelScope.launch {
            savedCouponRepository.getAllSavedCoupons().collectLatest { saved ->
                val ids = saved.map { it.couponId }.toSet()
                _uiState.update { it.copy(savedCouponIds = ids) }
            }
        }
    }

    // ── Mode toggles ──────────────────────────────────────────────────────────

    fun onPublicModeChanged(isPublic: Boolean) {
        _uiState.update { it.copy(isPublicMode = isPublic) }
        fetchAllCategories()
    }

    /**
     * Called when the "Exclusive" toggle on the categories screen is switched.
     * When ON  ("Coupons"): load partner coupons with offerType="Coupon".
     * When OFF ("Offers"):  load partner offers with offerType="Offer",
     *                        sorted by hasValidTrackingLink → discountWeight (backend).
     */
    fun onExclusiveModeChanged(isExclusive: Boolean) {
        _uiState.update { it.copy(isExclusiveMode = isExclusive, rawCoupons = emptyList(), rawCouponsPage = 1) }
        // Both modes now use the partner-coupons endpoint; only offerType differs.
        loadRawCoupons(resetPage = true)
    }

    // ── Exclusive mode: sort / filter / search ────────────────────────────────

    fun onSortOptionChanged(option: SortOption) {
        _currentSortOption.value = option
        if (_uiState.value.isExclusiveMode) loadRawCoupons(resetPage = true)
        else fetchAllCategories()
    }

    fun onCategoryChanged(category: String?) {
        val apiCategory = if (category == "See All") null else category
        _currentCategory.value = apiCategory
        if (_uiState.value.isExclusiveMode) loadRawCoupons(resetPage = true)
        else fetchAllCategories()
    }

    fun onFiltersChanged(filters: FilterOptions) {
        _currentFilters.value = filters
        if (_uiState.value.isExclusiveMode) loadRawCoupons(resetPage = true)
        else fetchAllCategories()
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            if (_uiState.value.isExclusiveMode) {
                loadRawCoupons(resetPage = true)
            } else if (_uiState.value.isPublicMode) {
                fetchAllCategories()
            } else {
                filterPrivateCouponsLocally(query)
            }
        }
    }

    // ── Pagination helpers ────────────────────────────────────────────────────

    fun loadNextRawPage() {
        val state = _uiState.value
        if (state.isLoadingRawCoupons) return
        if (state.rawCouponsPage >= state.rawCouponsPages) return
        loadRawCoupons(resetPage = false)
    }

    // ── Raw coupons loader ────────────────────────────────────────────────────

    fun loadRawCoupons(resetPage: Boolean = true) {
        rawLoadJob?.cancel()
        rawLoadJob = viewModelScope.launch {
            try {
                val currentPage = if (resetPage) 1 else (_uiState.value.rawCouponsPage + 1)
                _uiState.update { it.copy(isLoadingRawCoupons = true) }

                // Toggle ON (isExclusiveMode=true)  → "Coupon"  (with code, sorted by healthScore+discountWeight)
                // Toggle OFF (isExclusiveMode=false) → "Offer"   (no code, sorted by trackingLink+discountWeight)
                val offerType = if (_uiState.value.isExclusiveMode) "Coupon" else "Offer"

                // Sort-by is only exposed in the filter bar which is only shown in exclusive/Coupon mode.
                // For Offer mode the backend always applies its default aggregate sort.
                val sortByApi = if (_uiState.value.isExclusiveMode) _currentSortOption.value.apiValue else null

                val filters      = _currentFilters.value
                val discountType = convertDiscountTypeToApi(filters.discountType)
                val validity     = filters.getValidityApiValue()
                val categoryApi  = _currentCategory.value?.takeIf { it != "See All" }
                val mappedCategoryApi = CategoryMapper.getSubcategories(categoryApi)
                val searchApi    = _searchQuery.value.takeIf { it.isNotBlank() }

                Log.d(TAG, "loadRawCoupons page=$currentPage offerType=$offerType sortBy=$sortByApi category=$mappedCategoryApi search=$searchApi")

                when (val result = couponRepository.getPartnerCoupons(
                    category     = mappedCategoryApi,
                    brand        = filters.brand,
                    search       = searchApi,
                    discountType = discountType,
                    validity     = validity,
                    sortBy       = sortByApi,
                    page         = currentPage,
                    limit        = RAW_PAGE_SIZE,
                    tab          = "active",
                    offerType    = offerType
                )) {
                    is PartnerCouponResult.Success -> {
                        val newCoupons = if (resetPage) result.coupons
                                         else _uiState.value.rawCoupons + result.coupons
                        _uiState.update {
                            it.copy(
                                rawCoupons = newCoupons,
                                rawCouponsTotal = result.total,
                                rawCouponsPage = result.page,
                                rawCouponsPages = result.pages,
                                isLoadingRawCoupons = false,
                                errorMessage = if (newCoupons.isEmpty()) "No exclusive coupons found" else null
                            )
                        }
                    }
                    is PartnerCouponResult.Error -> {
                        Log.e(TAG, "Partner coupons error: ${result.message}")
                        _uiState.update {
                            it.copy(isLoadingRawCoupons = false, errorMessage = result.message)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "loadRawCoupons exception", e)
                _uiState.update { it.copy(isLoadingRawCoupons = false, errorMessage = e.message) }
            }
        }
    }

    // ── Normal category loader ────────────────────────────────────────────────

    fun fetchAllCategories() {
        val uid = firebaseAuth.currentUser?.uid ?: return
        val isPublicMode = _uiState.value.isPublicMode
        val query = _searchQuery.value

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            try {
                val groups = mutableListOf<CategoryGroup>()
                if (!isPublicMode) privateCouponsMap.clear()

                if (isPublicMode) {
                    for (category in categories) {
                        try {
                            val data = couponRepository.getCouponsByCategory(
                                uid = uid,
                                category = category,
                                limit = 10,
                                search = query.ifEmpty { null }
                            )
                            if (data != null && data.total > 0) {
                                groups.add(CategoryGroup(
                                    name = category,
                                    totalCount = data.total,
                                    coupons = data.coupons
                                ))
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error fetching category $category", e)
                        }
                    }
                } else {
                    val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                    val brands = syncedApps.map { it.appName.replaceFirstChar { c -> c.uppercase() } }

                    if (brands.isNotEmpty()) {
                        for (category in categories) {
                            try {
                                val result = couponRepository.syncPrivateCoupons(
                                    brands = brands, category = category, limit = 10
                                )
                                if (result is PrivateCouponResult.Success && result.coupons.isNotEmpty()) {
                                    val activeCoupons = result.coupons.filter { pc ->
                                        pc.status == "active" && (pc.daysUntilExpiry ?: 0) >= 0
                                    }
                                    if (activeCoupons.isNotEmpty()) {
                                        val mapped = activeCoupons.map { pc ->
                                            privateCouponsMap[pc.id] = pc
                                            CouponListItem(
                                                id = pc.id,
                                                brandName = pc.brandName,
                                                couponTitle = pc.couponTitle,
                                                description = pc.description,
                                                category = pc.category,
                                                daysUntilExpiry = pc.daysUntilExpiry,
                                                source = pc.source,
                                                couponImageBase64 = null
                                            )
                                        }
                                        groups.add(CategoryGroup(
                                            name = category,
                                            totalCount = activeCoupons.size,
                                            coupons = mapped
                                        ))
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "Error syncing category $category", e)
                            }
                        }
                    }
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        categoryGroups = groups,
                        errorMessage = if (groups.isEmpty()) "No coupons found" else null
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "fetchAllCategories exception", e)
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    // ── Save / remove ─────────────────────────────────────────────────────────

    fun saveCoupon(couponId: String, coupon: CouponListItem) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(CouponListItem::class.java)
                savedCouponRepository.saveCoupon(
                    couponId = couponId,
                    couponJson = adapter.toJson(coupon),
                    couponType = if (_uiState.value.isPublicMode) "public" else "private"
                )
            } catch (e: Exception) {
                Log.e(TAG, "saveCoupon error", e)
            }
        }
    }

    fun saveRawCoupon(coupon: PartnerCoupon) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(PartnerCoupon::class.java)
                savedCouponRepository.saveCoupon(
                    couponId = coupon.id,
                    couponJson = adapter.toJson(coupon),
                    couponType = "raw"
                )
            } catch (e: Exception) {
                Log.e(TAG, "saveRawCoupon error", e)
            }
            // Sync with backend remotely
            try {
                couponRepository.savePartnerCoupon(coupon.id)
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing saved partner coupon with backend: ${coupon.id}", e)
            }
        }
    }

    fun removeSavedCoupon(couponId: String) {
        viewModelScope.launch {
            try {
                savedCouponRepository.removeSavedCoupon(couponId)
            } catch (e: Exception) {
                Log.e(TAG, "removeSavedCoupon error", e)
            }
            // Sync with backend remotely (safe try-catch in case of non-partner coupon)
            try {
                couponRepository.unsavePartnerCoupon(couponId)
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing unsaved partner coupon with backend: $couponId", e)
            }
        }
    }

    fun getPrivateCoupon(couponId: String): PrivateCoupon? = privateCouponsMap[couponId]

    // ── Redeem (private only; raw coupons use onRedeem callback) ─────────────

    fun redeemCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val uid = firebaseAuth.currentUser?.uid
                    ?: return@launch onError("Please login to redeem coupon")

                when (val result = couponRepository.redeemPrivateCoupon(couponId, uid)) {
                    is PrivateCouponResult.Success -> {
                        onSuccess()
                        fetchAllCategories()
                    }
                    is PrivateCouponResult.Error -> onError(result.message)
                }
            } catch (e: Exception) {
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    /**
     * Mark a partner coupon as redeemed via the backend API and update local list.
     */
    fun redeemRawCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                when (val result = couponRepository.redeemPartnerCoupon(couponId)) {
                    is PartnerCouponRedeemResult.Success -> {
                        _uiState.update { state ->
                            state.copy(rawCoupons = state.rawCoupons.filter { it.id != couponId })
                        }
                        onSuccess()
                    }
                    is PartnerCouponRedeemResult.Error -> onError(result.message)
                }
            } catch (e: Exception) {
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    /**
     * Directly vote on a partner coupon's reliability.
     * outcome: "success" | "failure"
     */
    fun votePartnerCoupon(couponId: String, outcome: String) {
        viewModelScope.launch {
            Log.d(TAG, "Voting for partner coupon $couponId: $outcome")
            couponRepository.votePartnerCoupon(couponId, outcome)
        }
    }

    /**
     * Track discover analytics for trend calculations
     */
    fun trackPartnerDiscover(couponId: String) {
        viewModelScope.launch {
            couponRepository.trackPartnerDiscover(couponId)
            Log.d(TAG, "Trend discover tracked for partner coupon: $couponId")
        }
    }

    // ── Private coupon local search ───────────────────────────────────────────

    private fun filterPrivateCouponsLocally(query: String) {
        if (query.isEmpty()) { fetchAllCategories(); return }
        val filtered = _uiState.value.categoryGroups.map { group ->
            val fc = group.coupons.filter { c ->
                c.brandName?.contains(query, true) == true ||
                c.couponTitle?.contains(query, true) == true ||
                c.description?.contains(query, true) == true ||
                c.category?.contains(query, true) == true
            }
            group.copy(coupons = fc, totalCount = fc.size)
        }.filter { it.coupons.isNotEmpty() }
        _uiState.update { it.copy(categoryGroups = filtered) }
    }

    private fun convertDiscountTypeToApi(uiValue: String?): String? = when (uiValue) {
        "Percentage Off (% Off)" -> "percentage_off"
        "Flat Discount"          -> "flat_discount"
        "Cashback"               -> "cashback"
        "Buy 1 Get 1"            -> "buy1get1"
        "Free Delivery"          -> "free_delivery"
        "Wallet/UPI Offers"      -> "wallet_upi"
        "Prepaid Only Offers"    -> "prepaid_only"
        else                     -> null
    }
}
