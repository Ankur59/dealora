package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.data.api.models.CouponDisplay
import com.ayaan.dealora.data.api.models.CouponActions
import com.ayaan.dealora.data.api.models.ExclusiveCoupon
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.RawScrapedCoupon
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.ayaan.dealora.data.repository.FleetRepository
import com.ayaan.dealora.data.repository.FleetResult
import com.ayaan.dealora.data.api.models.PendingInteraction
import com.google.firebase.auth.FirebaseAuth
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for CouponDetailsScreen
 */
@HiltViewModel
class CouponDetailsViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val fleetRepository: FleetRepository,
    private val firebaseAuth: FirebaseAuth,
    private val moshi: Moshi,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        private const val TAG = "CouponDetailsViewModel"
    }

    private val couponId: String = checkNotNull(savedStateHandle["couponId"])
    private val _isPrivate: Boolean = savedStateHandle["isPrivate"] ?: false
    private val _couponCode: String? = savedStateHandle["couponCode"]
    private val _couponDataJson: String? = savedStateHandle["couponData"]

    private val _uiState = MutableStateFlow<CouponDetailsUiState>(CouponDetailsUiState.Loading)
    val uiState: StateFlow<CouponDetailsUiState> = _uiState.asStateFlow()

    private val _isPrivateState = MutableStateFlow(_isPrivate)
    val isPrivateMode: StateFlow<Boolean> = _isPrivateState.asStateFlow()

    private val _pendingInteractions = MutableStateFlow<List<PendingInteraction>>(emptyList())
    val pendingInteractions: StateFlow<List<PendingInteraction>> = _pendingInteractions.asStateFlow()

    init {
        Log.d(TAG, "========== ViewModel Initialized ==========")
        Log.d(TAG, "Coupon ID: $couponId")
        Log.d(TAG, "Is Private: $_isPrivate")
        
        if (!_couponDataJson.isNullOrBlank()) {
            handlePassedCouponData(_couponDataJson)
        } else {
            loadCouponDetails()
        }
        
        loadPendingInteractions()
    }

    private fun handlePassedCouponData(json: String) {
        try {
            if (_isPrivate) {
                val adapter = moshi.adapter(PrivateCoupon::class.java)
                val privateCoupon = adapter.fromJson(json)
                if (privateCoupon != null) {
                    _uiState.value = CouponDetailsUiState.Success(convertPrivateCouponToCouponDetail(privateCoupon))
                } else {
                    loadCouponDetails()
                }
            } else {
                // Try RawScrapedCoupon first (Exclusive mode)
                val rawAdapter = moshi.adapter(RawScrapedCoupon::class.java)
                val rawCoupon = rawAdapter.fromJson(json)
                if (rawCoupon != null && rawCoupon.brandName.isNotBlank()) {
                    Log.d(TAG, "✓ Successfully deserialized RawScrapedCoupon")
                    _uiState.value = CouponDetailsUiState.Success(convertRawCouponToCouponDetail(rawCoupon))
                } else {
                    // Fallback to legacy ExclusiveCoupon
                    val exclusiveAdapter = moshi.adapter(ExclusiveCoupon::class.java)
                    val exclusiveCoupon = exclusiveAdapter.fromJson(json)
                    if (exclusiveCoupon != null) {
                        Log.d(TAG, "✓ Successfully deserialized ExclusiveCoupon")
                        _uiState.value = CouponDetailsUiState.Success(convertExclusiveCouponToCouponDetail(exclusiveCoupon))
                    } else {
                        loadCouponDetails()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error deserializing coupon data", e)
            loadCouponDetails()
        }
    }

    fun loadCouponDetails() {
        viewModelScope.launch {
            _uiState.value = CouponDetailsUiState.Loading
            try {
                if (_isPrivate) {
                    val privateCoupon = couponRepository.getCachedCoupon(couponId)
                    if (privateCoupon != null) {
                        _uiState.value = CouponDetailsUiState.Success(convertPrivateCouponToCouponDetail(privateCoupon))
                        return@launch
                    }
                    
                    val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                    val syncedBrands = syncedApps.map { it.appName.replaceFirstChar { it.uppercase() } }
                    val apiCoupon = if (syncedBrands.isNotEmpty()) couponRepository.getPrivateCouponById(couponId, syncedBrands) else null
                    
                    if (apiCoupon != null) {
                        _uiState.value = CouponDetailsUiState.Success(convertPrivateCouponToCouponDetail(apiCoupon))
                        couponRepository.cacheCoupon(apiCoupon)
                    } else {
                        _uiState.value = CouponDetailsUiState.Error("Coupon not found")
                    }
                } else {
                    val exclusiveCoupon = couponRepository.getCachedExclusiveCoupon(couponId)
                    if (exclusiveCoupon != null) {
                        _uiState.value = CouponDetailsUiState.Success(convertExclusiveCouponToCouponDetail(exclusiveCoupon))
                    } else {
                        _uiState.value = CouponDetailsUiState.Error("Coupon data not available.")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading coupon details", e)
                _uiState.value = CouponDetailsUiState.Error("Unable to load details.")
            }
        }
    }

    fun retry() = loadCouponDetails()

    /**
     * Redeem a PRIVATE coupon — calls the backend to mark it as redeemed.
     * Used when isPrivateMode = true.
     */
    fun redeemCoupon(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                if (!_isPrivate) {
                    // Exclusive/scraped coupon — delegate to local-only path
                    redeemRawCoupon(onSuccess = onSuccess, onError = onError)
                    return@launch
                }
                val currentUser = firebaseAuth.currentUser ?: run {
                    onError("Please login to redeem coupon")
                    return@launch
                }
                when (val result = couponRepository.redeemPrivateCoupon(couponId, currentUser.uid)) {
                    is com.ayaan.dealora.data.repository.PrivateCouponResult.Success -> {
                        onSuccess()
                        loadCouponDetails()
                    }
                    is com.ayaan.dealora.data.repository.PrivateCouponResult.Error -> onError(result.message)
                }
            } catch (e: Exception) {
                onError("Unable to redeem coupon.")
            }
        }
    }

    /**
     * Redeem an EXCLUSIVE/scraped coupon — local-only, no backend call.
     * Mirrors the behaviour in CouponsListViewModel.redeemRawCoupon().
     * Used when isPrivateMode = false (exclusive mode in CouponsList).
     */
    fun redeemRawCoupon(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                // Record the redeem interaction first (explicit redeem press)
                recordInteraction("redeem")
                
                // No backend endpoint for scraped-coupon redemption (other than fleet stats).
                // Just signal success so the UI can show a confirmation.
                onSuccess()
            } catch (e: Exception) {
                onError("Unable to mark coupon as redeemed.")
            }
        }
    }

    /**
     * Record a user interaction with an exclusive coupon (copy, discover, redeem).
     * Only works for non-private mode.
     */
    fun recordInteraction(action: String) {
        if (_isPrivate) return // Only for exclusive coupons
        
        val currentState = _uiState.value
        if (currentState !is CouponDetailsUiState.Success) return
        
        val coupon = currentState.coupon
        val userId = firebaseAuth.currentUser?.uid ?: "anonymous"
        
        viewModelScope.launch {
            Log.d(TAG, "Recording interaction: $action for coupon: ${coupon.id}")
            fleetRepository.recordInteraction(
                userId = userId,
                couponId = coupon.id.toString(),
                brandName = coupon.brandName.toString(),
                couponCode = coupon.couponCode?.toString(),
                couponLink = coupon.websiteLink?.toString(),
                action = action
            )
        }
    }

    /**
     * Fetch pending interactions for the current user.
     */
    fun loadPendingInteractions() {
        val userId = firebaseAuth.currentUser?.uid ?: return
        
        viewModelScope.launch {
            when (val result = fleetRepository.getPendingInteractions(userId)) {
                is FleetResult.Success -> {
                    _pendingInteractions.value = result.data
                    Log.d(TAG, "Loaded ${result.data.size} pending interactions")
                }
                is FleetResult.Error -> {
                    Log.e(TAG, "Error loading pending interactions: ${result.message}")
                }
            }
        }
    }

    /**
     * Resolve a pending interaction.
     */
    fun resolveInteraction(interactionId: String, outcome: String) {
        viewModelScope.launch {
            when (val result = fleetRepository.resolveInteraction(interactionId, outcome)) {
                is FleetResult.Success -> {
                    // Remove from local list
                    _pendingInteractions.value = _pendingInteractions.value.filter { it.id != interactionId }
                    Log.d(TAG, "Resolved interaction $interactionId as $outcome")
                }
                is FleetResult.Error -> {
                    Log.e(TAG, "Error resolving interaction: ${result.message}")
                }
            }
        }
    }

    private fun convertPrivateCouponToCouponDetail(privateCoupon: PrivateCoupon): CouponDetail {
        val daysUntilExpiry = privateCoupon.daysUntilExpiry ?: computeDaysUntilExpiry(privateCoupon.expiryDate?.toString())
        return CouponDetail(
            id = privateCoupon.id,
            userId = privateCoupon.userId ?: "private_user",
            couponName = privateCoupon.brandName,
            brandName = privateCoupon.brandName,
            couponTitle = privateCoupon.couponTitle,
            description = privateCoupon.description,
            expireBy = privateCoupon.expiryDate,
            categoryLabel = privateCoupon.category,
            useCouponVia = "Online",
            discountType = privateCoupon.discountType ?: "percentage",
            discountValue = privateCoupon.discountValue,
            minimumOrder = privateCoupon.minimumOrderValue,
            couponCode = privateCoupon.couponCode,
            couponVisitingLink = privateCoupon.couponVisitingLink,
            websiteLink = privateCoupon.couponLink,
            couponDetails = privateCoupon.couponDetails ?: privateCoupon.description ?: "Visit brand website to redeem.",
            terms = privateCoupon.terms ?: "• Check brand website for terms\n• Subject to availability",
            status = privateCoupon.status ?: "active",
            addedMethod = privateCoupon.couponType,
            userType = privateCoupon.userType,
            base64ImageUrl = privateCoupon.base64ImageUrl,
            createdAt = privateCoupon.createdAt ?: "",
            updatedAt = privateCoupon.updatedAt ?: "",
            display = CouponDisplay(
                initial = privateCoupon.brandName.firstOrNull()?.toString() ?: "?",
                daysUntilExpiry = daysUntilExpiry,
                isExpiringSoon = (daysUntilExpiry ?: Int.MAX_VALUE) <= 7,
                formattedExpiry = daysUntilExpiry?.let { "$it days remaining" } ?: "No expiry",
                expiryStatusColor = "gray",
                badgeLabels = listOfNotNull(privateCoupon.category, "Private Coupon"),
                redemptionType = "online"
            ),
            actions = CouponActions(canEdit = false, canDelete = false, canRedeem = privateCoupon.redeemable ?: true, canShare = false)
        )
    }

    private fun convertRawCouponToCouponDetail(rawCoupon: RawScrapedCoupon): CouponDetail {
        // Prefer AI-enriched websiteLink (brand's actual website) over couponLink (scraper source URL)
        val brandWebsite = rawCoupon.websiteLink?.takeIf { it.isNotBlank() }
            ?: rawCoupon.homePage?.takeIf { it.isNotBlank() }
            ?: rawCoupon.couponLink

        // Build terms: use AI-enriched value if present, otherwise fallback
        val resolvedTerms = rawCoupon.terms?.takeIf { it.isNotBlank() }
            ?: "Scraped from public source. Subject to brand terms and conditions."

        return CouponDetail(
            id = rawCoupon.id,
            userId = "raw_scraped",
            couponName = rawCoupon.brandName,
            brandName = rawCoupon.brandName,
            couponTitle = rawCoupon.couponTitle,
            description = rawCoupon.description,
            expireBy = rawCoupon.expiryDate,
            categoryLabel = rawCoupon.category,
            useCouponVia = "Online",
            discountType = rawCoupon.discountType ?: "scraped",
            discountValue = rawCoupon.discountValue,
            minimumOrder = rawCoupon.minimumOrder?.let { if (it > 0) it.toInt() else null },
            couponCode = rawCoupon.couponCode,
            couponVisitingLink = null,
            websiteLink = brandWebsite,
            couponDetails = rawCoupon.description ?: "Redeem this exclusive coupon on the brand website.",
            terms = "• Scraped from public source\n• Verified: ${rawCoupon.verified ?: "Unknown"}\n• Subject to brand terms",
            status = "active",
            addedMethod = "exclusive",
            userType = null,
            base64ImageUrl = null,
            createdAt = rawCoupon.scrapedAt ?: "",
            updatedAt = "",
            display = CouponDisplay(
                initial = rawCoupon.brandName.firstOrNull()?.toString() ?: "?",
                daysUntilExpiry = rawCoupon.daysUntilExpiry,
                isExpiringSoon = (rawCoupon.daysUntilExpiry ?: Int.MAX_VALUE) <= 7,
                formattedExpiry = rawCoupon.daysUntilExpiry?.let { "$it days remaining" } ?: "No expiry",
                expiryStatusColor = "gray",
                badgeLabels = listOfNotNull(rawCoupon.category, "Exclusive Offer"),
                redemptionType = "online"
            ),
            actions = CouponActions(canEdit = false, canDelete = false, canRedeem = false, canShare = true)
        )
    }

    private fun convertExclusiveCouponToCouponDetail(exclusiveCoupon: ExclusiveCoupon): CouponDetail {
        return CouponDetail(
            id = exclusiveCoupon.id,
            userId = "exclusive_public",
            couponName = exclusiveCoupon.couponName,
            brandName = exclusiveCoupon.brandName,
            couponTitle = exclusiveCoupon.couponName,
            description = exclusiveCoupon.description,
            expireBy = exclusiveCoupon.expiryDate,
            categoryLabel = exclusiveCoupon.category,
            useCouponVia = "Online",
            discountType = "exclusive",
            discountValue = null,
            minimumOrder = null,
            couponCode = exclusiveCoupon.couponCode,
            couponVisitingLink = exclusiveCoupon.couponLink,
            websiteLink = exclusiveCoupon.couponLink,
            couponDetails = exclusiveCoupon.details ?: exclusiveCoupon.description ?: "Visit brand website to redeem.",
            terms = exclusiveCoupon.terms ?: "• Check brand website for terms",
            status = "active",
            addedMethod = "exclusive",
            base64ImageUrl = null,
            createdAt = exclusiveCoupon.createdAt ?: "",
            updatedAt = exclusiveCoupon.updatedAt ?: "",
            display = CouponDisplay(
                initial = exclusiveCoupon.brandName.firstOrNull()?.toString() ?: "?",
                daysUntilExpiry = exclusiveCoupon.daysUntilExpiry,
                isExpiringSoon = (exclusiveCoupon.daysUntilExpiry ?: 0) <= 7,
                formattedExpiry = exclusiveCoupon.daysUntilExpiry?.let { "$it days remaining" } ?: "No expiry",
                expiryStatusColor = "gray",
                badgeLabels = listOfNotNull(exclusiveCoupon.category, "Exclusive Coupon"),
                redemptionType = "online",
                isStackable = exclusiveCoupon.stackable?.lowercase()?.let { it == "yes" || it == "true" } ?: false
            ),
            actions = CouponActions(canEdit = false, canDelete = false, canRedeem = false, canShare = true)
        )
    }

    private fun computeDaysUntilExpiry(expiryDateStr: String?): Int? {
        if (expiryDateStr.isNullOrBlank()) return null
        return try {
            val datePart = expiryDateStr.substringBefore("T").trim()
            val parts = datePart.split("-")
            if (parts.size < 3) return null
            val expiry = java.util.Calendar.getInstance().apply {
                set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
                set(java.util.Calendar.MILLISECOND, 0)
            }
            val today = java.util.Calendar.getInstance().apply {
                set(get(java.util.Calendar.YEAR), get(java.util.Calendar.MONTH), get(java.util.Calendar.DAY_OF_MONTH), 0, 0, 0)
                set(java.util.Calendar.MILLISECOND, 0)
            }
            ((expiry.timeInMillis - today.timeInMillis) / (1000L * 60 * 60 * 24)).toInt()
        } catch (e: Exception) { null }
    }
}

sealed class CouponDetailsUiState {
    data object Loading : CouponDetailsUiState()
    data class Success(val coupon: CouponDetail) : CouponDetailsUiState()
    data class Error(val message: String) : CouponDetailsUiState()
}
