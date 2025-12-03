package com.ayaan.dealora.presentation.navigation

sealed class Route(path: String) {
    object SignUp: Route("signup")
    object SignIn: Route("signin")
    object Home: Route("home")
    object Profile: Route("profile")
}