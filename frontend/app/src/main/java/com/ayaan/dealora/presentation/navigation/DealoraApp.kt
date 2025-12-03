package com.ayaan.dealora.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.rememberNavController

@Composable
fun DealoraApp(navController: NavHostController = rememberNavController(),modifier: Modifier) {
    NavHost(
        navController = navController, startDestination = "home", modifier = modifier
    ){

    }
}