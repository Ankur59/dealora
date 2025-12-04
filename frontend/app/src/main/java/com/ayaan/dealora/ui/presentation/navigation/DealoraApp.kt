package com.ayaan.dealora.ui.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ayaan.dealora.ui.presentation.auth.SignUpScreen

@Composable
fun DealoraApp(navController: NavHostController = rememberNavController(), modifier: Modifier) {
    NavHost(
        navController = navController, startDestination = Route.SignUp.path, modifier = modifier
    ){
        composable(Route.SignUp.path) {
            SignUpScreen(navController)
        }
    }
}