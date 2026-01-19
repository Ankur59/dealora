package com.ayaan.dealora.ui.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.addcoupon.AddCoupons
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginFormScreen
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginOtpScreen
import com.ayaan.dealora.ui.presentation.auth.screens.login.LoginViewModel
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpFormScreen
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpOtpScreen
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpViewModel
import com.ayaan.dealora.ui.presentation.couponsList.CouponsList
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.CouponDetailsScreen
import com.ayaan.dealora.ui.presentation.home.HomeScreen
import com.ayaan.dealora.ui.presentation.navigation.Route.NotificationPreferences
import com.ayaan.dealora.ui.presentation.profile.ProfileScreen
import com.ayaan.dealora.ui.presentation.profile.about.AboutUsScreen
import com.ayaan.dealora.ui.presentation.profile.accountprivacy.AccountPrivacyScreen
import com.ayaan.dealora.ui.presentation.profile.appprivacy.AppPrivacyScreen
import com.ayaan.dealora.ui.presentation.profile.contactsupport.ContactSupportScreen
import com.ayaan.dealora.ui.presentation.profile.desync.DesyncAppScreen
import com.ayaan.dealora.ui.presentation.profile.faq.FAQScreen
import com.ayaan.dealora.ui.presentation.profile.notificationprefs.NotificationPreferencesScreen
import com.ayaan.dealora.ui.presentation.splash.SplashScreen
import com.ayaan.dealora.ui.presentation.syncapps.SelectAppsScreen
import com.ayaan.dealora.ui.presentation.syncapps.SyncApp
import com.ayaan.dealora.ui.presentation.syncapps.SyncAppsStart
import com.ayaan.dealora.ui.presentation.syncapps.SyncingProgressScreen
import com.google.firebase.auth.FirebaseAuth

@Composable
fun DealoraApp(navController: NavHostController = rememberNavController(), modifier: Modifier) {
    val auth = FirebaseAuth.getInstance()
    val user = auth.currentUser?.uid
    val startDestination= if (user.isNullOrEmpty()) Route.SignUp.path else Route.Home.path
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
//        startDestination = Route.ExploreCoupons.path
    ) {
        composable(
            route = Route.CouponDetails.path,
            arguments = listOf(
                navArgument("couponId") { type = NavType.StringType },
                navArgument("isPrivate") {
                    type = NavType.BoolType
                    defaultValue = false
                },
                navArgument("couponCode") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                })) {
            CouponDetailsScreen(navController)
        }
        composable(Route.AccountPrivacy.path) {
            AccountPrivacyScreen(navController)
        }
        composable(Route.AboutUs.path) {
            AboutUsScreen(navController)
        }
        // Add this composable
        composable(
            route = Route.SyncingProgress.path,
            arguments = listOf(
                navArgument("selectedApps") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->

            val selectedAppIds =
                backStackEntry.arguments
                    ?.getString("selectedApps")
                    ?.split(",")
                    ?: emptyList()

            val allApps = listOf(
                SyncApp("zomato", "Zomato", R.drawable.zomato_logo),
                SyncApp("phonepe", "Phone Pay", R.drawable.logo),
                SyncApp("blinkit", "Blinkit", R.drawable.zomato_logo),
                SyncApp("amazon", "Amazon", R.drawable.logo),
                SyncApp("nykaa", "Nykaa", R.drawable.zomato_logo),
                SyncApp("cred", "CRED", R.drawable.logo),
                SyncApp("swiggy", "Swiggy", R.drawable.zomato_logo),
                SyncApp("zepto", "Zepto", R.drawable.logo),
                SyncApp("licious", "Licious", R.drawable.zomato_logo),
                SyncApp("dealora", "Dealora", R.drawable.logo),
            )

            val selectedApps = allApps.filter { it.id in selectedAppIds }

            SyncingProgressScreen(selectedApps = selectedApps,navController=navController)
        }

        composable(Route.SelectAppsScreen.path) {
            SelectAppsScreen(
                navController = navController,
                onAllowSyncClick = { selectedAppIds ->
                    navController.navigate(Route.SyncingProgress.createRoute(selectedAppIds))
                }
            )
        }
        composable(Route.AppPrivacy.path) {
            AppPrivacyScreen(navController)
        }
        composable(Route.ContactSupport.path) {
            ContactSupportScreen(navController)
        }
        composable(Route.DesyncApps.path) {
            DesyncAppScreen(navController)
        }
        composable(NotificationPreferences.path) {
            NotificationPreferencesScreen(navController)
        }
        composable(Route.FAQ.path) {
            FAQScreen(navController)
        }
        // Sign Up Flow
        composable(Route.SignUp.path) { backStackEntry ->
            val viewModel: SignUpViewModel = hiltViewModel(backStackEntry)
            SignUpFormScreen(
                onNavigateToOtp = { navController.navigate(Route.SignUpOtp.path) },
                onNavigateToLogin = { navController.navigate(Route.SignIn.path) },
                viewModel = viewModel
            )
        }
        composable(Route.Splash.path) {
            SplashScreen(navController)
        }
        composable(Route.ExploreCoupons.path) {
            CouponsList(navController)
        }
        composable(Route.Profile.path) {
            ProfileScreen(navController)
        }
        composable(Route.SyncAppsStart.path){
            SyncAppsStart(navController)
        }
//        composable(Route.SelectAppsScreen.path){
//            SelectAppsScreen(navController = navController)
//        }
        composable(Route.SignUpOtp.path) { backStackEntry ->
            val parentEntry = remember(backStackEntry) {
                navController.getBackStackEntry(Route.SignUp.path)
            }
            val viewModel: SignUpViewModel = hiltViewModel(parentEntry)
            SignUpOtpScreen(
                onNavigateBack = { navController.popBackStack() }, onNavigateToHome = {
                    navController.navigate(Route.Home.path) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                }, viewModel = viewModel
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
                onNavigateBack = { navController.popBackStack() }, onNavigateToHome = {
                    navController.navigate(Route.Home.path) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                }, viewModel = viewModel
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