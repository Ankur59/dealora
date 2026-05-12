package com.ayaan.couponviewer.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Rewards : Screen("rewards")
    object CouponDetail : Screen("coupon_detail/{couponId}") {
        fun createRoute(couponId: Int) = "coupon_detail/$couponId"
    }
}
