package com.ayaan.dealora.ui.presentation.navigation

sealed class Route(val path: String) {
    data object SignUp: Route("signup")
    data object SignUpOtp: Route("signup_otp")
    data object SignIn: Route("signin")
    data object LoginOtp: Route("login_otp")
    data object Home: Route("home")
    data object Profile: Route("profile")
    data object Dashboard: Route("dashboard")
    data object AddCoupon:Route("addcoupon")
    data object Splash:Route("splash")
    data object ExploreCoupons:Route("explorecoupons")
    data object ContactSupport:Route("contactsupport")
    data object FAQ:Route("faq")
    data object AppPrivacy:Route("appprivacy")
    data object AboutUs:Route("aboutus")
    data object AccountPrivacy:Route("accountprivacy")
    data object NotificationPreferences:Route("notificationpreferences")
    data object Notifications:Route("notifications")
    data object DesyncApps:Route("desyncapp")
    data object SyncAppsStart:Route("syncappsstart")
    data object SelectAppsScreen:Route("selectapps")
    data object SyncingProgress: Route("syncingprogress/{selectedApps}") {
        fun createRoute(selectedApps: List<String>) =
            "syncingprogress/${selectedApps.joinToString(",")}"
    }
    object CouponDetails:Route("coupondetails/{couponId}?isPrivate={isPrivate}&couponCode={couponCode}") {
        fun createRoute(couponId: String, isPrivate: Boolean = false, couponCode: String? = null) =
            "coupondetails/$couponId?isPrivate=$isPrivate&couponCode=${couponCode ?: ""}"
    }
}