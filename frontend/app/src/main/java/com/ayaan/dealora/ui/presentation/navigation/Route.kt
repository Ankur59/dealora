package com.ayaan.dealora.ui.presentation.navigation

sealed class Route(val path: String) {
    data object SignUp: Route("signup")
    data object SignIn: Route("signin")
    data object Home: Route("home")
    data object Profile: Route("profile")
}