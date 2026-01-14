package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponDetail
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

    private val _uiState = MutableStateFlow<CouponDetailsUiState>(CouponDetailsUiState.Loading)
    val uiState: StateFlow<CouponDetailsUiState> = _uiState.asStateFlow()

    init {
        loadCouponDetails()
    }

    fun loadCouponDetails() {
        viewModelScope.launch {
            _uiState.value = CouponDetailsUiState.Loading

            try {
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
}

/**
 * UI State for CouponDetailsScreen
 */
sealed class CouponDetailsUiState {
    data object Loading : CouponDetailsUiState()
    data class Success(val coupon: CouponDetail) : CouponDetailsUiState()
    data class Error(val message: String) : CouponDetailsUiState()
}

