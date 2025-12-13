package com.ayaan.dealora.ui.presentation.couponsList

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar

@Composable
fun CouponsList(navController: NavController) {
    Scaffold(
        containerColor = Color.White, topBar = {
            CouponsListTopBar(
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .background(Color.White)
        ) {

        }
    }
}