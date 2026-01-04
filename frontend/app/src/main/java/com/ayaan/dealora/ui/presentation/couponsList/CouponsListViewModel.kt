package com.ayaan.dealora.ui.presentation.couponsList

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.repository.CouponRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for CouponsList screen
 */
@HiltViewModel
class CouponsListViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "CouponsListViewModel"
    }

    private val _uiState = MutableStateFlow<CouponsListUiState>(CouponsListUiState.Loading)
    val uiState: StateFlow<CouponsListUiState> = _uiState.asStateFlow()

    private val _couponsFlow = MutableStateFlow<PagingData<CouponListItem>>(PagingData.empty())
    val couponsFlow: StateFlow<PagingData<CouponListItem>> = _couponsFlow.asStateFlow()

//    init {
//        loadCoupons()
//    }

    fun loadCoupons(
        status: String = "active",
        brand: String? = null,
        category: String? = null,
        discountType: String? = null
    ) {
        viewModelScope.launch {
            _uiState.value = CouponsListUiState.Loading

            try {
                val currentUser = firebaseAuth.currentUser
                if (currentUser == null) {
                    Log.e(TAG, "User not authenticated")
                    _uiState.value = CouponsListUiState.Error("Please login to view your coupons.")
                    return@launch
                }

                val uid = currentUser.uid
                Log.d(TAG, "Loading coupons for uid: $uid")
                _uiState.value = CouponsListUiState.Success

                // Collect paging data
                couponRepository.getCoupons(
                    uid = uid,
                    status = status,
                    brand = brand,
                    category = category,
                    discountType = discountType
                ).cachedIn(viewModelScope).collectLatest { pagingData ->
                    _couponsFlow.value = pagingData
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading coupons", e)
                _uiState.value = CouponsListUiState.Error("Unable to load coupons. Please try again.")
            }
        }
    }

    fun retry() {
        loadCoupons()
    }
}

/**
 * UI State for CouponsList screen
 */
sealed class CouponsListUiState {
    data object Loading : CouponsListUiState()
    data object Success : CouponsListUiState()
    data class Error(val message: String) : CouponsListUiState()
}

