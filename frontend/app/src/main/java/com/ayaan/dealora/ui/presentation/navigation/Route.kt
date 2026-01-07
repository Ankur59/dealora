package com.ayaan.dealora.ui.presentation.navigation

sealed class Route(val path: String) {
    data object SignUp: Route("signup")
    data object SignUpOtp: Route("signup_otp")
    data object SignIn: Route("signin")
    data object LoginOtp: Route("login_otp")
    data object Home: Route("home")
    data object Profile: Route("profile")
    data object AddCoupon:Route("addcoupon")
    data object Splash:Route("splash")
    data object ExploreCoupons:Route("explorecoupons")
    data object ContactSupport:Route("contactsupport")
    data object FAQ:Route("faq")
    data object AppPrivacy:Route("appprivacy")
    data object AboutUs:Route("aboutus")
    data object AccountPrivacy:Route("accountprivacy")
    data object NotificationPreferences:Route("notificationpreferences")
}