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
import com.ayaan.dealora.data.repository.CouponDetailResult
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

    // Expose isPrivate as StateFlow
    private val _isPrivateState = MutableStateFlow(_isPrivate)
    val isPrivateMode: StateFlow<Boolean> = _isPrivateState.asStateFlow()

    init {
        Log.d(TAG, "========== ViewModel Initialized ==========")
        Log.d(TAG, "Coupon ID: $couponId")
        Log.d(TAG, "Is Private: $_isPrivate")
        Log.d(TAG, "Coupon Code: $_couponCode")
        
        if (!_couponDataJson.isNullOrBlank()) {
            Log.d(TAG, "Found couponData in arguments, attempting to deserialize...")
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
                    Log.d(TAG, "✓ Successfully deserialized PrivateCoupon")
                    val couponDetail = convertPrivateCouponToCouponDetail(privateCoupon)
                    _uiState.value = CouponDetailsUiState.Success(couponDetail)
                    // Also cache it just in case
                    viewModelScope.launch {
                        couponRepository.cacheCoupon(privateCoupon)
                    }
                } else {
                    Log.e(TAG, "Failed to deserialize PrivateCoupon from JSON")
                    loadCouponDetails()
                }
            } else {
                val adapter = moshi.adapter(ExclusiveCoupon::class.java)
                val exclusiveCoupon = adapter.fromJson(json)
                if (exclusiveCoupon != null) {
                    Log.d(TAG, "✓ Successfully deserialized ExclusiveCoupon")
                    val couponDetail = convertExclusiveCouponToCouponDetail(exclusiveCoupon)
                    _uiState.value = CouponDetailsUiState.Success(couponDetail)
                    // Also cache it for compatibility
                    viewModelScope.launch {
                        couponRepository.cacheExclusiveCoupon(exclusiveCoupon)
                    }
                } else {
                    Log.e(TAG, "Failed to deserialize ExclusiveCoupon from JSON")
                    loadCouponDetails()
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
                // If it's a private coupon, fetch from private coupons API
                if (_isPrivate) {
                    Log.d(TAG, "Loading private coupon with id: $couponId")

                    // Step 1: Try to get from cache (ExploringCoupons caches coupons before navigation)
                    var privateCoupon: PrivateCoupon? = couponRepository.getCachedCoupon(couponId)

                    if (privateCoupon != null) {
                        Log.d(TAG, "✓ Found coupon in cache: $couponId")
                        val couponDetail = convertPrivateCouponToCouponDetail(privateCoupon)
                        _uiState.value = CouponDetailsUiState.Success(couponDetail)
                        return@launch
                    }

                    Log.d(TAG, "Coupon not in cache, trying API fetch...")

                    // Step 2: Try with hardcoded brands (ExploringCoupons compatibility)
                    val hardcodedBrands = listOf("Amazon", "Blinkit", "Cred", "Nykaa")
                    Log.d(TAG, "Attempt 1: Fetching private coupon for hardcoded brands: ${hardcodedBrands.joinToString()}")
                    privateCoupon = couponRepository.getPrivateCouponById(couponId, hardcodedBrands)

                    // Step 3: If not found, try with synced apps (CouponsList compatibility)
                    if (privateCoupon == null) {
                        Log.d(TAG, "Coupon not found with hardcoded brands, trying synced apps...")
                        val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                        val syncedBrands = syncedApps.map { syncedApp ->
                            syncedApp.appName.replaceFirstChar { it.uppercase() }
                        }

                        Log.d(TAG, "Attempt 2: Fetching private coupon for synced brands: ${syncedBrands.joinToString()}")

                        if (syncedBrands.isNotEmpty()) {
                            privateCoupon = couponRepository.getPrivateCouponById(couponId, syncedBrands)
                        }
                    }

                    if (privateCoupon != null) {
                        // Convert PrivateCoupon to CouponDetail
                        val couponDetail = convertPrivateCouponToCouponDetail(privateCoupon)
                        _uiState.value = CouponDetailsUiState.Success(couponDetail)
                        // Cache it for next time
                        couponRepository.cacheCoupon(privateCoupon)
                    } else {
                        Log.e(TAG, "Private coupon not found")
                        _uiState.value = CouponDetailsUiState.Error("Coupon not found")
                    }
                    return@launch
                } else {
                    // Public mode - EXCLUSIVE COUPONS ONLY USE CACHE
                    Log.d(TAG, "Loading exclusive coupon with id: $couponId")

                    val exclusiveCoupon = couponRepository.getCachedExclusiveCoupon(couponId)
                    if (exclusiveCoupon != null) {
                        Log.d(TAG, "✓ Found exclusive coupon in cache: $couponId")
                        val couponDetail = convertExclusiveCouponToCouponDetail(exclusiveCoupon)
                        _uiState.value = CouponDetailsUiState.Success(couponDetail)
                        return@launch
                    } else {
                        // Exclusive coupon not found in cache - this should not happen
                        Log.e(TAG, "❌ Exclusive coupon not found in cache: $couponId")
                        _uiState.value = CouponDetailsUiState.Error("Coupon data not available. Please go back and try again.")
                        return@launch
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading coupon details", e)
                _uiState.value = CouponDetailsUiState.Error("Unable to load coupon details. Please try again.")
            }
        }
    }

    fun retry() {
        loadCouponDetails()
    }

    fun redeemCoupon(onSuccess: () -> Unit, onError: (String) -> Unit) {
        Log.d(TAG, "========== REDEEM COUPON FLOW STARTED ==========")
        Log.d(TAG, "Coupon ID from SavedStateHandle: $couponId")
        Log.d(TAG, "Is Private Mode: $_isPrivate")

        viewModelScope.launch {
            try {
                // Only allow redeeming private coupons for now
                if (!_isPrivate) {
                    Log.e(TAG, "Not a private coupon, aborting redeem")
                    onError("Only private coupons can be redeemed")
                    return@launch
                }

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
                    is com.ayaan.dealora.data.repository.PrivateCouponResult.Success -> {
                        Log.d(TAG, "✓ SUCCESS: Coupon redeemed successfully")
                        Log.d(TAG, "Response message: ${result.message}")
                        Log.d(TAG, "Response coupons count: ${result.coupons.size}")
                        if (result.coupons.isNotEmpty()) {
                            val redeemedCoupon = result.coupons[0]
                            Log.d(TAG, "Redeemed coupon details:")
                            Log.d(TAG, "  - ID: ${redeemedCoupon.id}")
                            Log.d(TAG, "  - Brand: ${redeemedCoupon.brandName}")
                            Log.d(TAG, "  - Redeemable: ${redeemedCoupon.redeemable}")
                            Log.d(TAG, "  - Redeemed: ${redeemedCoupon.redeemed}")
                            Log.d(TAG, "  - Redeemed By: ${redeemedCoupon.redeemedBy}")
                            Log.d(TAG, "  - Redeemed At: ${redeemedCoupon.redeemedAt}")
                        }
                        onSuccess()
                        // Reload the coupon details to show updated state
                        loadCouponDetails()
                    }
                    is com.ayaan.dealora.data.repository.PrivateCouponResult.Error -> {
                        Log.e(TAG, "✗ ERROR: ${result.message}")
                        onError(result.message)
                    }
                }
                Log.d(TAG, "========== REDEEM COUPON FLOW COMPLETED ==========")
            } catch (e: Exception) {
                Log.e(TAG, "✗ EXCEPTION in redeem flow: ${e.message}", e)
                Log.e(TAG, "Exception stack trace:", e)
                onError("Unable to redeem coupon. Please try again.")
            }
        }
    }

    private fun convertPrivateCouponToCouponDetail(privateCoupon: PrivateCoupon): CouponDetail {
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
            couponVisitingLink = privateCoupon.couponLink,
            couponDetails = privateCoupon.couponDetails ?: (privateCoupon.description ?: "Visit the brand website to redeem this coupon."),
            terms = privateCoupon.terms ?: "• Check brand website for complete terms\n• Subject to availability\n• Cannot be combined with other offers",
            status = "active",
            addedMethod = privateCoupon.couponType,

            base64ImageUrl = privateCoupon.base64ImageUrl,
            createdAt = privateCoupon.createdAt ?: System.currentTimeMillis().toString(),
            updatedAt = privateCoupon.updatedAt ?: System.currentTimeMillis().toString(),
            display = CouponDisplay(
                initial = privateCoupon.brandName.firstOrNull()?.toString() ?: "?",
                daysUntilExpiry = privateCoupon.daysUntilExpiry,
                isExpiringSoon = (privateCoupon.daysUntilExpiry ?: 0) <= 7,
                formattedExpiry = privateCoupon.daysUntilExpiry?.let { "$it days remaining" } ?: "No expiry",
                expiryStatusColor = when {
                    privateCoupon.daysUntilExpiry == null -> "gray"
                    privateCoupon.daysUntilExpiry <= 3 -> "red"
                    privateCoupon.daysUntilExpiry <= 7 -> "orange"
                    else -> "green"
                },
                badgeLabels = listOfNotNull(
                    privateCoupon.category,
                    "Private Coupon"
                ),
                redemptionType = "online"
            ),
            actions = CouponActions(
                canEdit = false,
                canDelete = false,
                canRedeem = privateCoupon.redeemable ?: true,
                canShare = false
            )
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
            couponDetails = exclusiveCoupon.details ?: (exclusiveCoupon.description ?: "Visit the brand website to redeem this exclusive coupon."),
            terms = exclusiveCoupon.terms ?: "• Check brand website for complete terms\n• Subject to availability\n• Cannot be combined with other offers",
            status = "active",
            addedMethod = "exclusive",
            base64ImageUrl = null,
            createdAt = exclusiveCoupon.createdAt ?: System.currentTimeMillis().toString(),
            updatedAt = exclusiveCoupon.updatedAt ?: System.currentTimeMillis().toString(),
            display = CouponDisplay(
                initial = exclusiveCoupon.brandName.firstOrNull()?.toString() ?: "?",
                daysUntilExpiry = exclusiveCoupon.daysUntilExpiry,
                isExpiringSoon = (exclusiveCoupon.daysUntilExpiry ?: 0) <= 7,
                formattedExpiry = exclusiveCoupon.daysUntilExpiry?.let { "$it days remaining" } ?: "No expiry",
                expiryStatusColor = when {
                    exclusiveCoupon.daysUntilExpiry == null -> "gray"
                    exclusiveCoupon.daysUntilExpiry <= 3 -> "red"
                    exclusiveCoupon.daysUntilExpiry <= 7 -> "orange"
                    else -> "green"
                },
                badgeLabels = listOfNotNull(
                    exclusiveCoupon.category,
                    "Exclusive Coupon",
                    exclusiveCoupon.source?.let { "Source: $it" },
                    exclusiveCoupon.stackable?.let { if (it == "yes" || it == "true") "Stackable" else null }
                ),
                redemptionType = "online"
            ),
            actions = CouponActions(
                canEdit = false,
                canDelete = false,
                canRedeem = false, // Exclusive coupons are not redeemable through the app
                canShare = true
            )
        )
    }
}

/**
 * UI State for CouponDetailsScreen
 */
sealed class CouponDetailsUiState {
    data object Loading : CouponDetailsUiState()
    data class Success(val coupon: CouponDetail) : CouponDetailsUiState()
    data class Error(val message: String) : CouponDetailsUiState()
}

