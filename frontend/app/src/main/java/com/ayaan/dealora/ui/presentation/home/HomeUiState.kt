package com.ayaan.dealora.ui.presentation.home

import com.ayaan.dealora.data.api.models.CouponStatistics
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.User

/**
 * UI state for Home screen
 */
data class HomeUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val statistics: CouponStatistics? = null,
    val errorMessage: String? = null,
    val exploreCoupons: List<PrivateCoupon> = emptyList(),
    val isLoadingCoupons: Boolean = false
)

