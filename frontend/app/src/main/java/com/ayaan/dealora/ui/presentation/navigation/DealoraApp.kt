package com.ayaan.dealora.ui.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ayaan.dealora.ui.presentation.addcoupon.AddCoupons
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginFormScreen
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginOtpScreen
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginViewModel
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpFormScreen
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpOtpScreen
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpViewModel
import com.ayaan.dealora.ui.presentation.couponsList.CouponsList
import com.ayaan.dealora.ui.presentation.home.HomeScreen
import com.ayaan.dealora.ui.presentation.home.components.ExploringCoupons
import com.ayaan.dealora.ui.presentation.splash.SplashScreen
import com.google.firebase.auth.FirebaseAuth

@Composable
fun DealoraApp(navController: NavHostController = rememberNavController(), modifier: Modifier) {
    val auth = FirebaseAuth.getInstance()
    val user= auth.currentUser?.uid
    val startDestination = if(user.isNullOrEmpty()) Route.SignUp.path else Route.Home.path
    NavHost(
        navController = navController,
        startDestination = Route.Splash.path,
        modifier = modifier
    ) {
        // Sign Up Flow
        composable(Route.SignUp.path) { backStackEntry ->
            val viewModel: SignUpViewModel = hiltViewModel(backStackEntry)
            SignUpFormScreen(
                onNavigateToOtp = { navController.navigate(Route.SignUpOtp.path) },
                onNavigateToLogin = { navController.navigate(Route.SignIn.path) },
                viewModel = viewModel
            )
        }
        composable(Route.Splash.path){
            SplashScreen(navController)
        }
        composable(Route.ExploreCoupons.path) {
            CouponsList(navController)
        }
        composable(Route.SignUpOtp.path) { backStackEntry ->
            val parentEntry = remember(backStackEntry) {
                navController.getBackStackEntry(Route.SignUp.path)
            }
            val viewModel: SignUpViewModel = hiltViewModel(parentEntry)
            SignUpOtpScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToHome = {
                    navController.navigate(Route.Home.path) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                viewModel = viewModel
            )
        }

        // Login Flow
        composable(Route.SignIn.path) { backStackEntry ->
            val viewModel: LoginViewModel = hiltViewModel(backStackEntry)
            LoginFormScreen(
                onNavigateToOtp = { navController.navigate(Route.LoginOtp.path) },
                onNavigateToSignUp = { navController.navigate(Route.SignUp.path) },
                viewModel = viewModel
            )
        }

        composable(Route.LoginOtp.path) { backStackEntry ->
            val parentEntry = remember(backStackEntry) {
                navController.getBackStackEntry(Route.SignIn.path)
            }
            val viewModel: LoginViewModel = hiltViewModel(parentEntry)
            LoginOtpScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToHome = {
                    navController.navigate(Route.Home.path) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                viewModel = viewModel
            )
        }

        composable(Route.Home.path) {
            HomeScreen(navController)
        }
        composable(Route.AddCoupon.path) {
            AddCoupons(navController)
        }
    }
}