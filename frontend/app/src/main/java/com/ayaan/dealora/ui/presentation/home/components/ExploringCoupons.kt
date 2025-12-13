package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.ayaan.dealora.R

@Composable
fun ExploringCoupons(navController: NavController) {
    LazyRow {
        items(5) {
            Image(
                painter = painterResource(R.drawable.coupon_filled),
                contentDescription = "Coupon Banner",
                modifier = Modifier.fillMaxSize()
            )
            Spacer(modifier = Modifier.width(17.dp))
        }
    }
}