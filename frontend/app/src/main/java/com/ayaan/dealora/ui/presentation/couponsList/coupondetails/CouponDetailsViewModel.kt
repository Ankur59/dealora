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
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for CouponDetailsScreen
 */
@HiltViewModel
class CouponDetailsViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
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
        loadCouponDetails()
    }

    fun loadCouponDetails() {
        viewModelScope.launch {
            _uiState.value = CouponDetailsUiState.Loading

            try {
                // If it's a private coupon, fetch from private coupons API
                if (_isPrivate) {
                    Log.d(TAG, "Loading private coupon with id: $couponId")
                    val privateCoupon = couponRepository.getPrivateCouponById(couponId)

                    if (privateCoupon != null) {
                        // Convert PrivateCoupon to CouponDetail
                        val couponDetail = convertPrivateCouponToCouponDetail(privateCoupon)
                        _uiState.value = CouponDetailsUiState.Success(couponDetail)
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

    private fun convertPrivateCouponToCouponDetail(privateCoupon: PrivateCoupon): CouponDetail {
        return CouponDetail(
            id = privateCoupon.id,
            userId = "private_user",
            couponName = privateCoupon.brandName,
            brandName = privateCoupon.brandName,
            couponTitle = privateCoupon.couponTitle,
            description = privateCoupon.description,
            expireBy = privateCoupon.expiryDate,
            categoryLabel = privateCoupon.category,
            useCouponVia = "Online",
            discountType = "percentage",
            discountValue = null,
            minimumOrder = null,
            couponCode = privateCoupon.couponCode,
            couponVisitingLink = privateCoupon.couponLink,
            couponDetails = privateCoupon.description ?: "Visit the brand website to redeem this coupon.",
            terms = "• Check brand website for complete terms\n• Subject to availability\n• Cannot be combined with other offers",
            status = "active",
            addedMethod = "private",
            base64ImageUrl = null,
            createdAt = System.currentTimeMillis().toString(),
            updatedAt = System.currentTimeMillis().toString(),
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

