package com.ayaan.couponviewer.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ayaan.couponviewer.data.repository.CouponRepository
import com.ayaan.couponviewer.ui.screens.HomeScreen
import com.ayaan.couponviewer.ui.screens.RewardsScreen
import com.ayaan.couponviewer.ui.screens.CouponViewerScreen

@Composable
fun NavGraph(
    navController: NavHostController,
    couponRepository: CouponRepository,
    onRedeemClick: (Int) -> Unit,
    onShareClick: (Int) -> Unit,
    onCopyClick: (Int) -> Unit
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onNavigateToRewards = {
                    navController.navigate(Screen.Rewards.route)
                }
            )
        }

        composable(Screen.Rewards.route) {
            RewardsScreen(
                coupons = couponRepository.getCoupons(),
                onCouponClick = { couponId ->
                    navController.navigate(Screen.CouponDetail.createRoute(couponId))
                },
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.CouponDetail.route,
            arguments = listOf(navArgument("couponId") { type = NavType.IntType })
        ) { backStackEntry ->
            val couponId = backStackEntry.arguments?.getInt("couponId") ?: 0
            val couponData = couponRepository.getCouponById(couponId)

            if (couponData != null) {
                CouponViewerScreen(
                    couponData = couponData,
                    onRedeemClick = { onRedeemClick(couponId) },
                    onShareClick = { onShareClick(couponId) },
                    onCopyClick = { onCopyClick(couponId) }
                )
            }
        }
    }
}
