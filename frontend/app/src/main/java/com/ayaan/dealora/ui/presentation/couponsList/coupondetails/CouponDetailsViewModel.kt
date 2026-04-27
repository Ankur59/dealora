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

    init {
        Log.d(TAG, "========== ViewModel Initialized ==========")
        Log.d(TAG, "Coupon ID: $couponId")
        Log.d(TAG, "Is Private: $_isPrivate")
        
        if (!_couponDataJson.isNullOrBlank()) {
            handlePassedCouponData(_couponDataJson)
        } else {
            loadCouponDetails()
        }
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

    fun redeemCoupon(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                if (!_isPrivate) {
                    onError("Only private coupons can be redeemed")
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
            minimumOrder = null,
            couponCode = rawCoupon.couponCode,
            couponVisitingLink = rawCoupon.couponLink,
            websiteLink = rawCoupon.couponLink,
            couponDetails = rawCoupon.description ?: "Redeem this scraped coupon on the brand website.",
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
