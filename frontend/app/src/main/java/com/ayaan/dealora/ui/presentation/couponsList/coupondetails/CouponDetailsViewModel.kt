package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.data.api.models.CouponDisplay
import com.ayaan.dealora.data.api.models.CouponActions
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
                // If it's a private coupon, generate mock data
                if (_isPrivate) {
                    Log.d(TAG, "Loading private coupon with id: $couponId")
                    val mockCoupon = generateMockPrivateCoupon(couponId)
                    _uiState.value = CouponDetailsUiState.Success(mockCoupon)
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

    private fun generateMockPrivateCoupon(couponId: String): CouponDetail {
        // Use the passed coupon code, or generate a random one as fallback
        val couponCode = _couponCode ?: generateRandomCouponCode()

        return CouponDetail(
            id = couponId,
            userId = "private_user",
            couponName = "Private Coupon",
            brandName = "Bombay Shaving Company",
            couponTitle = "Buy 1 items, Get extra 10% off",
            description = "Get Extra 10% off on mcaffine Bodywash, lotion and many more.",
            expireBy = null,
            categoryLabel = "Beauty",
            useCouponVia = "Online",
            discountType = "percentage",
            discountValue = 10,
            minimumOrder = 0,
            couponCode = couponCode,
            couponVisitingLink = null,
            couponDetails = "This is a private coupon. Visit the brand website to redeem.",
            terms = "• Valid for online purchases only\n• One time use per customer\n• Cannot be combined with other offers",
            status = "active",
            addedMethod = "manual",
            base64ImageUrl = null,
            createdAt = System.currentTimeMillis().toString(),
            updatedAt = System.currentTimeMillis().toString(),
            display = CouponDisplay(
                initial = "B",
                daysUntilExpiry = 23,
                isExpiringSoon = false,
                formattedExpiry = "23 days remaining",
                expiryStatusColor = "green",
                badgeLabels = listOf("Beauty", "Private Coupon"),
                redemptionType = "online"
            ),
            actions = CouponActions(
                canEdit = false,
                canDelete = false,
                canRedeem = true,
                canShare = false
            )
        )
    }

    private fun generateRandomCouponCode(): String {
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return (1..8)
            .map { chars.random() }
            .joinToString("")
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

