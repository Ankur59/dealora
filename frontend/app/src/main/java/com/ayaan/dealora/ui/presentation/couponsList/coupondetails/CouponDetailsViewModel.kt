package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.data.api.models.CouponDisplay
import com.ayaan.dealora.data.api.models.CouponActions
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.CouponDetailResult
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.google.firebase.auth.FirebaseAuth
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
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        private const val TAG = "CouponDetailsViewModel"
    }

    private val couponId: String = checkNotNull(savedStateHandle["couponId"])
    private val _isPrivate: Boolean = savedStateHandle["isPrivate"] ?: false
    private val _couponCode: String? = savedStateHandle["couponCode"]

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
        loadCouponDetails()
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
                }

                val currentUser = firebaseAuth.currentUser
                if (currentUser == null) {
                    Log.e(TAG, "User not authenticated")
                    _uiState.value = CouponDetailsUiState.Error("Please login to view coupon details.")
                    return@launch
                }

                val uid = currentUser.uid
                Log.d(TAG, "Loading coupon details for id: $couponId, uid: $uid")

                when (val result = couponRepository.getCouponById(couponId, uid)) {
                    is CouponDetailResult.Success -> {
                        Log.d(TAG, "Coupon details loaded successfully")
                        _uiState.value = CouponDetailsUiState.Success(result.coupon)
                    }
                    is CouponDetailResult.Error -> {
                        Log.e(TAG, "Error loading coupon details: ${result.message}")
                        _uiState.value = CouponDetailsUiState.Error(result.message)
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
            addedMethod = "private",
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
}

/**
 * UI State for CouponDetailsScreen
 */
sealed class CouponDetailsUiState {
    data object Loading : CouponDetailsUiState()
    data class Success(val coupon: CouponDetail) : CouponDetailsUiState()
    data class Error(val message: String) : CouponDetailsUiState()
}

