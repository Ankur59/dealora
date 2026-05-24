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
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.PartnerCoupon
import com.squareup.moshi.Moshi
import com.ayaan.dealora.data.repository.PrivateCouponStatisticsResult
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.data.repository.FleetRepository
import com.ayaan.dealora.data.repository.FleetResult
import com.ayaan.dealora.data.repository.PartnerCouponResult
import com.ayaan.dealora.data.repository.PartnerCouponRedeemResult
import com.ayaan.dealora.data.repository.PartnerCouponInteractionRepository
import com.ayaan.dealora.data.repository.PartnerInteractionResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val profileRepository: ProfileRepository,
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val fleetRepository: FleetRepository,
    private val partnerInteractionRepository: PartnerCouponInteractionRepository,
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

    private var searchJob: Job? = null
    val searchQuery = MutableStateFlow("")

    init {
        observeSavedCoupons()
        fetchPendingInteractions()
        fetchPendingPartnerInteractions()
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
                    // Update FCM token
                    updateFcmToken()
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
                Log.d(TAG, "fetchExploreCoupons: Fetching all active explore coupons sorted by expiry")
                _uiState.update { it.copy(isLoadingCoupons = true) }

                // Call sync endpoint with empty brands list to get all brands
                when (val result = couponRepository.syncPrivateCoupons(
                    brands = emptyList(), // No brand filter as requested
                    category = null,
                    search = null,
                    discountType = null,
                    price = null, // Relaxed price filter to show more coupons
                    validity = "valid_this_week",
                    sortBy = "expiring_soon", // Sort by expiring soon
                    page = null,
                    limit = 5, // Limit to 5 coupons for home screen
                    status = "active" // Only fetch active coupons
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

    /**
     * Fetch pending interactions for the current user.
     *
     * Deduplication: the raw list may contain multiple entries for the same coupon
     * (e.g. user copied, then discovered the same coupon).  We keep only the first
     * entry per couponId so the popup shows one row per coupon, not one per action.
     * All sibling interactions are stored internally and resolved together.
     */
    fun fetchPendingInteractions() {
        val userId = firebaseAuth.currentUser?.uid ?: return

        viewModelScope.launch {
            when (val result = fleetRepository.getPendingInteractions(userId)) {
                is FleetResult.Success -> {
                    // Deduplicate: one entry per unique couponId
                    val deduplicated = result.data
                        .groupBy { it.couponId }
                        .values
                        .mapNotNull { it.firstOrNull() }
                    _uiState.update { it.copy(
                        pendingInteractions = deduplicated,
                        // Keep the full raw list for bulk-resolve
                        allPendingInteractionIds = result.data.map { it.id }
                    ) }
                    Log.d(TAG, "Loaded ${result.data.size} raw pending → ${deduplicated.size} deduplicated")
                }
                is FleetResult.Error -> {
                    Log.e(TAG, "Error loading pending interactions: ${result.message}")
                }
            }
        }
    }

    /**
     * Resolve a coupon interaction by couponId.
     * Finds ALL pending interaction IDs for this couponId (including duplicates)
     * and resolves them all with the same outcome.
     */
    fun resolveInteraction(couponId: String, outcome: String) {
        val state = _uiState.value
        // All raw IDs belonging to this couponId
        val sibling = _uiState.value.pendingInteractions
            .filter { it.couponId == couponId }
            .map { it.id }
        // Also check full raw list stored in allPendingInteractionIds — but we
        // don't have the raw objects there, so we resolve by couponId grouping.
        // The deduplicated list gives us enough to remove the row from the UI.

        viewModelScope.launch {
            sibling.forEach { id ->
                fleetRepository.resolveInteraction(id, outcome)
            }
            // Remove this coupon's row from the UI
            _uiState.update { s ->
                s.copy(
                    pendingInteractions = s.pendingInteractions.filter { it.couponId != couponId }
                )
            }
            Log.d(TAG, "Resolved ${sibling.size} interaction(s) for coupon $couponId as $outcome")
        }
    }

    /**
     * Resolve all pending interactions as skipped.
     */
    fun skipAllInteractions() {
        val allIds = _uiState.value.allPendingInteractionIds
        viewModelScope.launch {
            allIds.forEach { id -> fleetRepository.resolveInteraction(id, "skipped") }
            _uiState.update { it.copy(pendingInteractions = emptyList(), allPendingInteractionIds = emptyList()) }
        }
    }

    // ── Partner Coupon Interactions ────────────────────────────────────────────

    /**
     * Fetch pending PARTNER coupon interactions for the current user.
     * These are recorded when the user taps "Discover" on an exclusive/partner
     * coupon in CouponsList. On next app open the popup asks "did it work?".
     */
    fun fetchPendingPartnerInteractions() {
        val userId = firebaseAuth.currentUser?.uid ?: return

        viewModelScope.launch {
            when (val result = partnerInteractionRepository.getPendingInteractions(userId)) {
                is PartnerInteractionResult.Success -> {
                    val deduplicated = result.data
                        .groupBy { it.couponId }
                        .values
                        .mapNotNull { it.firstOrNull() }
                    _uiState.update { it.copy(
                        pendingPartnerInteractions = deduplicated,
                        allPendingPartnerInteractionIds = result.data.map { it.id }
                    ) }
                    Log.d(TAG, "Loaded ${result.data.size} raw partner pending → ${deduplicated.size} deduplicated")
                }
                is PartnerInteractionResult.Error -> {
                    Log.e(TAG, "Error loading pending partner interactions: ${result.message}")
                }
            }
        }
    }

    /**
     * Resolve a PARTNER coupon interaction by couponId.
     * Resolves all sibling interactions for the same couponId.
     */
    fun resolvePartnerInteraction(couponId: String, outcome: String) {
        val siblings = _uiState.value.pendingPartnerInteractions
            .filter { it.couponId == couponId }
            .map { it.id }

        viewModelScope.launch {
            siblings.forEach { id ->
                partnerInteractionRepository.resolveInteraction(id, outcome)
            }
            _uiState.update { s ->
                s.copy(
                    pendingPartnerInteractions = s.pendingPartnerInteractions.filter { it.couponId != couponId }
                )
            }
            Log.d(TAG, "Resolved ${siblings.size} partner interaction(s) for coupon $couponId as $outcome")
        }
    }

    /**
     * Skip all pending partner interactions.
     */
    fun skipAllPartnerInteractions() {
        val allIds = _uiState.value.allPendingPartnerInteractionIds
        viewModelScope.launch {
            allIds.forEach { id -> partnerInteractionRepository.resolveInteraction(id, "skipped") }
            _uiState.update {
                it.copy(pendingPartnerInteractions = emptyList(), allPendingPartnerInteractionIds = emptyList())
            }
        }
    }

    // ── Search & Partner Coupon Operations ───────────────────────────────────

    /**
     * Called whenever user types in the search bar.
     * 
     * Validation:
     * - Requires minimum 3 characters to trigger search
     * - Debounces API calls by 500ms to avoid excessive requests
     * - Clears results if user clears the search
     */
    fun onSearchQueryChanged(query: String) {
        searchQuery.value = query
        
        // If search is blank, clear results and cancel any pending searches
        if (query.isBlank()) {
            searchJob?.cancel()
            _uiState.update {
                it.copy(
                    searchCoupons = emptyList(),
                    searchCouponsTotal = 0,
                    searchCouponsPage = 1,
                    searchCouponsPages = 1,
                    isLoadingSearchCoupons = false,
                    searchError = null
                )
            }
            Log.d(TAG, "Search cleared - showing empty state")
            return
        }
        
        // Minimum 3 characters required for search
        if (query.trim().length < 3) {
            Log.d(TAG, "Search query too short (${query.length} chars) - need at least 3")
            _uiState.update {
                it.copy(
                    searchCoupons = emptyList(),
                    searchCouponsTotal = 0,
                    searchCouponsPage = 1,
                    searchCouponsPages = 1,
                    isLoadingSearchCoupons = false,
                    searchError = null
                )
            }
            return
        }
        
        // Debounce search API calls (500ms)
        // Cancel previous search job if user is still typing
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500) // 500ms debounce for better performance
            loadSearchCoupons(resetPage = true)
        }
        
        Log.d(TAG, "Search query updated: '$query' (${query.length} chars) - will execute after debounce")
    }

    fun loadSearchCoupons(resetPage: Boolean = true) {
        val query = searchQuery.value
        if (query.isBlank()) return

        viewModelScope.launch {
            try {
                val currentPage = if (resetPage) 1 else (_uiState.value.searchCouponsPage + 1)
                if (resetPage) {
                    _uiState.update { it.copy(isLoadingSearchCoupons = true, searchError = null, searchCoupons = emptyList()) }
                } else {
                    _uiState.update { it.copy(isLoadingSearchCoupons = true, searchError = null) }
                }

                Log.d(TAG, "loadSearchCoupons page=$currentPage query=$query")

                when (val result = couponRepository.searchPartnerCoupons(
                    q     = query,
                    page  = currentPage,
                    limit = 20,
                )) {
                    is PartnerCouponResult.Success -> {
                        val newCoupons = if (resetPage) result.coupons
                                         else _uiState.value.searchCoupons + result.coupons
                        _uiState.update {
                            it.copy(
                                searchCoupons = newCoupons,
                                searchCouponsTotal = result.total,
                                searchCouponsPage = result.page,
                                searchCouponsPages = result.pages,
                                isLoadingSearchCoupons = false,
                                searchError = if (newCoupons.isEmpty()) "No verified coupons found" else null
                            )
                        }
                    }
                    is PartnerCouponResult.Error -> {
                        Log.e(TAG, "Search coupons error: ${result.message}")
                        _uiState.update {
                            it.copy(isLoadingSearchCoupons = false, searchError = result.message)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "loadSearchCoupons exception", e)
                _uiState.update { it.copy(isLoadingSearchCoupons = false, searchError = e.message) }
            }
        }
    }

    fun loadNextSearchPage() {
        val state = _uiState.value
        if (state.isLoadingSearchCoupons) return
        if (state.searchCouponsPage >= state.searchCouponsPages) return
        loadSearchCoupons(resetPage = false)
    }

    fun savePartnerCoupon(coupon: PartnerCoupon) {
        viewModelScope.launch {
            try {
                val adapter = moshi.adapter(PartnerCoupon::class.java)
                savedCouponRepository.saveCoupon(
                    couponId = coupon.id,
                    couponJson = adapter.toJson(coupon),
                    couponType = "raw"
                )
            } catch (e: Exception) {
                Log.e(TAG, "savePartnerCoupon error", e)
            }
        }
    }

    fun redeemPartnerCoupon(couponId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                when (val result = couponRepository.redeemPartnerCoupon(couponId)) {
                    is PartnerCouponRedeemResult.Success -> {
                        // Mark as redeemed locally/optimistically
                        _uiState.update { state ->
                            state.copy(searchCoupons = state.searchCoupons.map {
                                if (it.id == couponId) it.copy(isRedeemed = true) else it
                            })
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

    fun trackPartnerDiscover(couponId: String) {
        viewModelScope.launch {
            couponRepository.trackPartnerDiscover(couponId)
        }
    }

    fun recordPartnerDiscover(coupon: PartnerCoupon) {
        val userId = firebaseAuth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                partnerInteractionRepository.recordInteraction(
                    userId     = userId,
                    couponId   = coupon.couponId ?: coupon.id,
                    brandName  = coupon.brandName,
                    couponCode = coupon.couponCode,
                    couponLink = coupon.couponLink,
                    action     = "discover"
                )
                Log.d(TAG, "Partner discover interaction recorded for ${coupon.brandName}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record partner discover interaction", e)
            }
        }
        viewModelScope.launch {
            couponRepository.trackPartnerDiscover(coupon.id)
            Log.d(TAG, "Trend discover tracked for partner coupon: ${coupon.id}")
        }
    }

    fun votePartnerCoupon(couponId: String, outcome: String) {
        viewModelScope.launch {
            Log.d(TAG, "Voting for partner coupon $couponId: $outcome")
            couponRepository.votePartnerCoupon(couponId, outcome)
        }
    }
}
