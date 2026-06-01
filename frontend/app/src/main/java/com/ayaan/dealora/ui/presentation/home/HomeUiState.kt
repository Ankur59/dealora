package com.ayaan.dealora.ui.presentation.home

import com.ayaan.dealora.data.api.models.CouponStatistics
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.PartnerCoupon
import com.ayaan.dealora.data.api.models.User
import com.ayaan.dealora.data.api.models.PendingInteraction
import com.ayaan.dealora.data.api.models.PendingPartnerInteraction

/**
 * UI state for Home screen
 */
data class HomeUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val statistics: CouponStatistics? = null,
    val errorMessage: String? = null,
    val exploreCoupons: List<PrivateCoupon> = emptyList(),
    val isLoadingCoupons: Boolean = false,
    // Deduplicated list (one row per coupon) shown in the feedback popup
    val pendingInteractions: List<PendingInteraction> = emptyList(),
    // All raw interaction IDs — needed so skipAll resolves every duplicate too
    val allPendingInteractionIds: List<String> = emptyList(),
    // Partner coupon pending interactions (from partner-coupon-interactions endpoint)
    val pendingPartnerInteractions: List<PendingPartnerInteraction> = emptyList(),
    val allPendingPartnerInteractionIds: List<String> = emptyList(),

    // ── Search overlay mode state ───────────────────────────
    val searchCoupons: List<PartnerCoupon> = emptyList(),
    val searchCouponsTotal: Int = 0,
    val searchCouponsPage: Int = 1,
    val searchCouponsPages: Int = 1,
    val isLoadingSearchCoupons: Boolean = false,
    val searchError: String? = null,
    val searchCategories: List<String> = emptyList(),
    val selectedSearchCategory: String? = null,
    val searchMode: String = "Coupon",
    val isSearchExpanded: Boolean = false,
    val isSearchForced: Boolean = false
)
